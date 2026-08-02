import { Router } from "express";
import crypto from "crypto";
import {
  db, feePaymentsTable, feeStructuresTable, feeCategoriesTable,
  studentsTable, classesTable, appSettingsTable, studentParentTable,
  transportRoutesTable,
} from "@workspace/db";
import { eq, and, like, ilike } from "drizzle-orm";
import { requireAuth } from "../lib/auth-middleware";
import { logger } from "../lib/logger";
import { resolvePrevDueAmount, getPrevYearDueMonthsRemaining } from "../lib/prev-year-due";
import nodemailer from "nodemailer";

const router = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getSetting(key: string): Promise<string> {
  const rows = await db.select({ value: appSettingsTable.value }).from(appSettingsTable).where(eq(appSettingsTable.key, key));
  return rows[0]?.value ?? "";
}

async function upsertSetting(key: string, value: string): Promise<void> {
  await db.insert(appSettingsTable).values({ key, value })
    .onConflictDoUpdate({ target: appSettingsTable.key, set: { value, updatedAt: new Date() } });
}

async function getRazorpayCredentials() {
  const keyId = await getSetting("razorpay_key_id");
  const keySecret = await getSetting("razorpay_key_secret");
  return { keyId, keySecret };
}

async function getRazorpayClient() {
  const { keyId, keySecret } = await getRazorpayCredentials();
  if (!keyId || !keySecret) return null;
  const Razorpay = (await import("razorpay")).default;
  return { client: new Razorpay({ key_id: keyId, key_secret: keySecret }), keyId, keySecret };
}

async function getMailer() {
  const gmailUser = process.env.GMAIL_USER || await getSetting("gmail_user");
  const gmailPass = (process.env.GMAIL_APP_PASSWORD || await getSetting("gmail_app_password")).replace(/\s/g, "");
  if (!gmailUser || !gmailPass) return null;
  return {
    transport: nodemailer.createTransport({ host: "smtp.gmail.com", port: 587, secure: false, auth: { user: gmailUser, pass: gmailPass }, tls: { rejectUnauthorized: false } }),
    from: gmailUser,
  };
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function monthName(m: number) { return MONTHS[(m - 1) % 12] || String(m); }

// ─── DB-backed order context (survives restarts) ──────────────────────────────
// Stored as appSetting with key `razorpay_order_{orderId}`, TTL 30 min enforced on read.

interface OrderContext {
  studentId: number;
  classId: number;
  selections: Array<{ month: number; year: number }>;
  session: string;
  amountPaise: number;
  createdAt: number; // ms timestamp
  includePrevDue?: boolean;
  prevDueAmountPaise?: number; // amount allocated to prev year due
  prevDueMonths?: number[]; // specific previous-due months selected (empty/omitted = old-style lump)
}

async function saveOrderContext(orderId: string, ctx: OrderContext): Promise<void> {
  await upsertSetting(`razorpay_order_${orderId}`, JSON.stringify(ctx));
}

async function loadOrderContext(orderId: string): Promise<OrderContext | null> {
  const raw = await getSetting(`razorpay_order_${orderId}`);
  if (!raw) return null;
  try {
    const ctx = JSON.parse(raw) as OrderContext;
    if (Date.now() - ctx.createdAt > 30 * 60 * 1000) {
      // Expired — clean up
      await db.delete(appSettingsTable).where(eq(appSettingsTable.key, `razorpay_order_${orderId}`));
      return null;
    }
    return ctx;
  } catch {
    return null;
  }
}

async function deleteOrderContext(orderId: string): Promise<void> {
  await db.delete(appSettingsTable).where(eq(appSettingsTable.key, `razorpay_order_${orderId}`));
}

// ─── Fee calculation helpers (mirror frontend logic exactly) ──────────────────

/** School year order: Apr=0, May=1, … Mar=11 */
const SCHOOL_YEAR_ORDER = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
function schoolYearIdx(month: number) { return SCHOOL_YEAR_ORDER.indexOf(month); }

interface StudentTransportInfo {
  hasVehicle: boolean;
  transportFromMonth: number;
  transportStopMonth: number | null;
  transportRoutePricePerMonth: string | null;
  studentType: string | null;
}

interface FeeStructureWithFreq {
  categoryId: number;
  categoryName: string;
  amount: string;
  frequency: string;
}

interface ExistingPayment {
  categoryId: number;
  month: number;
  year: number;
  amount: string;
  paidAmount: string;
  discount: string;
  status: string;
  isPreviousDue: boolean;
}

/**
 * Compute total paise due for the given month selections.
 * Mirrors the frontend's getMonthBalance() logic:
 *   1. Tuition structures filtered by frequency
 *   2. Transport fee from the student's assigned route
 *   3. Admission fee for "new" students in April only
 *   4. Subtracts already-paid amounts from existing payment records
 */
function computeSelectionPaise(
  selections: Array<{ month: number; year: number }>,
  structures: FeeStructureWithFreq[],
  existing: ExistingPayment[],
  student: StudentTransportInfo,
  admissionCategoryId: number | null,
): number {
  const tuitionStructs = structures.filter(st => {
    const cn = st.categoryName.toLowerCase();
    return !cn.includes("transport") && !cn.includes("bus") && !cn.includes("admission");
  });
  const admissionStruct = admissionCategoryId !== null
    ? structures.find(s => s.categoryId === admissionCategoryId) ?? null
    : null;

  let totalPaise = 0;

  for (const sel of selections) {
    const idx = schoolYearIdx(sel.month); // 0=Apr … 11=Mar

    // ── If any direct (non-carry-forward) payment record already exists for
    // this month — e.g. the admin collected a partial amount in person — the
    // true remaining balance is (actual recorded total) − (actual paid so
    // far) − (already carry-forward-cleared amount). This mirrors the
    // frontend's getMonthBalance()/getMonthTotal() exactly, and is what
    // online-verify/public-verify will record, so the charged amount always
    // matches what's displayed as "due" for the month. Recomputing from fee
    // structures instead (as the code below does for months with no records
    // yet) is unsafe here: it doesn't know how the original payment was split
    // across categories, and per-category lookups can silently miss records
    // (e.g. transport isn't a fee-structure row at all — it comes from the
    // student's route — so it can never match a "structures" based lookup).
    const directRecsForMonth = existing.filter(p =>
      p.month === sel.month && p.year === sel.year && !p.isPreviousDue
    );
    if (directRecsForMonth.length > 0) {
      const total = directRecsForMonth.reduce((s, p) => s + parseFloat(p.amount ?? "0") - parseFloat(p.discount ?? "0"), 0);
      const directPaid = directRecsForMonth.reduce((s, p) => s + parseFloat(p.paidAmount ?? "0"), 0);
      const cfPaidSoFar = existing
        .filter(p => p.month === sel.month && p.year === sel.year && p.isPreviousDue)
        .reduce((s, p) => s + parseFloat(p.paidAmount ?? "0"), 0);
      const balance = Math.max(0, total - directPaid - cfPaidSoFar);
      if (balance > 0) totalPaise += Math.round(balance * 100);
      continue;
    }

    // ── No payment records yet this month — compute theoretical due from fee
    // structures (first-time full-month payment). ──────────────────────────

    // ── 1. Tuition (frequency-aware) ──────────────────────────────────────────
    for (const st of tuitionStructs) {
      const amt = parseFloat(st.amount ?? "0");
      const freq = (st.frequency || "monthly").toLowerCase();
      // Does this structure apply to this month?
      const applies =
        freq === "monthly" ? true :
        freq === "quarterly" ? idx % 3 === 0 :
        freq === "annually" ? idx === 0 :
        freq === "one-time" ? idx === 0 :
        true;
      if (!applies) continue;

      const directRec = existing.find(p =>
        p.categoryId === st.categoryId && p.month === sel.month && p.year === sel.year && !p.isPreviousDue
      );
      const cfPaid = existing
        .filter(p => p.categoryId === st.categoryId && p.month === sel.month && p.year === sel.year && p.isPreviousDue)
        .reduce((s, p) => s + parseFloat(p.paidAmount ?? "0"), 0);

      let balance: number;
      if (directRec) {
        const alreadyPaid = parseFloat(directRec.paidAmount ?? "0");
        const discount = parseFloat(directRec.discount ?? "0");
        balance = amt - alreadyPaid - discount - cfPaid;
      } else {
        balance = amt - cfPaid;
      }
      if (balance > 0) totalPaise += Math.round(balance * 100);
    }

    // ── 2. Admission fee — new students, April only ───────────────────────────
    if (idx === 0 && admissionStruct && (student.studentType ?? "").toLowerCase().trim().includes("new")) {
      const alreadyPaid = existing.some(
        p => p.categoryId === admissionStruct.categoryId && !p.isPreviousDue
      );
      if (!alreadyPaid) {
        totalPaise += Math.round(parseFloat(admissionStruct.amount ?? "0") * 100);
      }
    }

    // ── 3. Transport fee ──────────────────────────────────────────────────────
    if (student.hasVehicle && student.transportRoutePricePerMonth) {
      const fromIdx = schoolYearIdx(student.transportFromMonth ?? 4);
      const mIdx = idx;
      const stopIdx = student.transportStopMonth !== null
        ? schoolYearIdx(student.transportStopMonth)
        : -1;
      const applies =
        mIdx >= fromIdx &&
        (stopIdx < 0 || mIdx < stopIdx);
      if (applies) {
        const routePrice = parseFloat(String(student.transportRoutePricePerMonth)) || 0;
        // Check existing transport payment record for this month
        const transportCatIds = structures
          .filter(s => s.categoryName.toLowerCase().includes("transport") || s.categoryName.toLowerCase().includes("bus"))
          .map(s => s.categoryId);
        let transportBalance = routePrice;
        for (const catId of transportCatIds) {
          const directRec = existing.find(p => p.categoryId === catId && p.month === sel.month && p.year === sel.year && !p.isPreviousDue);
          if (directRec) {
            const paid = parseFloat(directRec.paidAmount ?? "0");
            const disc = parseFloat(directRec.discount ?? "0");
            const cfPaid = existing.filter(p => p.categoryId === catId && p.month === sel.month && p.year === sel.year && p.isPreviousDue).reduce((s, p) => s + parseFloat(p.paidAmount ?? "0"), 0);
            transportBalance -= (paid + disc + cfPaid);
          }
        }
        if (transportBalance > 0) totalPaise += Math.round(transportBalance * 100);
      }
    }
  }

  return totalPaise;
}

// ─── Ownership verification: confirm parent owns studentId ───────────────────

async function parentOwnsStudent(parentId: number, studentId: number): Promise<boolean> {
  const rows = await db.select({ studentId: studentParentTable.studentId })
    .from(studentParentTable)
    .where(and(eq(studentParentTable.parentId, parentId), eq(studentParentTable.studentId, studentId)));
  return rows.length > 0;
}

// ─── GET /settings/razorpay/status ── public, tells frontend if Razorpay is ready
router.get("/settings/razorpay/status", async (_req, res) => {
  const keyId = await getSetting("razorpay_key_id");
  const mode = await getSetting("razorpay_mode") || "test";
  res.json({ configured: !!keyId, mode });
});

// ─── GET /settings/razorpay ── admin only
router.get("/settings/razorpay", requireAuth("admin"), async (_req, res) => {
  const keyId = await getSetting("razorpay_key_id");
  const keySecret = await getSetting("razorpay_key_secret");
  const mode = await getSetting("razorpay_mode") || "test";
  res.json({
    keyId,
    keySecret: keySecret ? "••••••••••••••••" : "",
    mode,
    configured: !!(keyId && keySecret),
  });
});

// ─── POST /settings/razorpay ── admin only
// If keySecret is omitted or still masked, only keyId and mode are updated.
router.post("/settings/razorpay", requireAuth("admin"), async (req, res) => {
  const { keyId, keySecret, mode } = req.body as { keyId?: string; keySecret?: string; mode?: string };

  if (!keyId?.trim()) {
    return res.status(400).json({ error: "keyId is required" });
  }

  const ops: Promise<void>[] = [
    upsertSetting("razorpay_key_id", keyId.trim()),
    upsertSetting("razorpay_mode", mode === "live" ? "live" : "test"),
  ];

  // Only update the secret if a real value was provided (not the masked placeholder)
  const isMasked = !keySecret || /^[•\s]+$/.test(keySecret);
  if (!isMasked) {
    ops.push(upsertSetting("razorpay_key_secret", keySecret!.replace(/\s/g, "")));
  }

  await Promise.all(ops);
  logger.info({ keyId: keyId.trim(), mode, secretUpdated: !isMasked }, "Razorpay settings updated");
  return res.json({ ok: true });
});

// ─── POST /fees/payments/online-order ── parent auth ─────────────────────────
router.post("/fees/payments/online-order", requireAuth("parent"), async (req, res) => {
  const parentId: number = (req as any).user.id;
  const { studentId, selections, session, includePrevDue, prevDueMonths } = req.body as {
    studentId: number;
    selections: Array<{ month: number; year: number }>;
    session: string;
    includePrevDue?: boolean;
    prevDueMonths?: number[];
  };

  if (!studentId || !session) {
    return res.status(400).json({ error: "studentId and session are required" });
  }
  if (!selections?.length && !includePrevDue) {
    return res.status(400).json({ error: "Select at least one month or include previous year due" });
  }

  // Ownership check: ensure this parent is linked to the student
  const owns = await parentOwnsStudent(parentId, studentId);
  if (!owns) {
    logger.warn({ parentId, studentId }, "Parent attempted payment for unlinked student");
    return res.status(403).json({ error: "You are not authorized to pay for this student." });
  }

  // Derive classId + transport info from DB — never trust the frontend
  const [student] = await db.select({
    classId: studentsTable.classId,
    hasVehicle: studentsTable.hasVehicle,
    transportFromMonth: studentsTable.transportFromMonth,
    transportStopMonth: studentsTable.transportStopMonth,
    transportRoutePricePerMonth: transportRoutesTable.pricePerMonth,
    studentType: studentsTable.studentType,
    previousYearDue: studentsTable.previousYearDue,
    previousYearDueRemarks: studentsTable.previousYearDueRemarks,
  })
    .from(studentsTable)
    .leftJoin(transportRoutesTable, eq(studentsTable.transportRouteId, transportRoutesTable.id))
    .where(eq(studentsTable.id, studentId));
  if (!student?.classId) {
    return res.status(400).json({ error: "Student class information not found." });
  }
  const classId = student.classId;

  const rzp = await getRazorpayClient();
  if (!rzp) return res.status(503).json({ error: "Online payment is not configured. Please contact the school." });

  // Get fee structures for this class + session (with frequency)
  const structures = await db.select({
    categoryId: feeStructuresTable.categoryId,
    categoryName: feeCategoriesTable.name,
    amount: feeStructuresTable.amount,
    frequency: feeCategoriesTable.frequency,
  })
    .from(feeStructuresTable)
    .innerJoin(feeCategoriesTable, eq(feeStructuresTable.categoryId, feeCategoriesTable.id))
    .where(and(eq(feeStructuresTable.classId, classId), eq(feeStructuresTable.session, session)));

  if (structures.length === 0) {
    return res.status(400).json({ error: "No fee structure found for this class and session." });
  }

  // Identify admission category id (if any)
  const admissionCatId = structures.find(s => s.categoryName.toLowerCase().includes("admission"))?.categoryId ?? null;

  // Get existing payments for this student + session (including CF records)
  const existing = await db.select({
    categoryId: feePaymentsTable.categoryId,
    month: feePaymentsTable.month,
    year: feePaymentsTable.year,
    amount: feePaymentsTable.amount,
    paidAmount: feePaymentsTable.paidAmount,
    discount: feePaymentsTable.discount,
    status: feePaymentsTable.status,
    isPreviousDue: feePaymentsTable.isPreviousDue,
  })
    .from(feePaymentsTable)
    .where(and(eq(feePaymentsTable.studentId, studentId), eq(feePaymentsTable.session, session)));

  // Calculate payable amount using shared helper (frequency + transport + admission aware)
  let totalPaise = computeSelectionPaise(selections ?? [], structures, existing, student, admissionCatId);

  // Add previous year due to the order if requested — computed server-side
  // from the selected months (or the full remaining lump if no monthly
  // breakdown exists), never trusted from the client directly.
  let prevDueAmountPaise = 0;
  let resolvedPrevDueMonths: number[] = [];
  if (includePrevDue) {
    const prevYearDueTotal = parseFloat(String(student.previousYearDue ?? "0")) || 0;
    // Only count month-0 "previous year due" settlement rows here — matches
    // the frontend's reconciliation logic. Month-specific carry-forward
    // clearance rows also set isPreviousDue=true but belong to a different
    // month's balance, not the previous-year lump sum.
    const prevPaid = await db.select({ paidAmount: feePaymentsTable.paidAmount })
      .from(feePaymentsTable)
      .where(and(
        eq(feePaymentsTable.studentId, studentId),
        eq(feePaymentsTable.isPreviousDue, true),
        eq(feePaymentsTable.month, 0),
      ));
    const prevPaidTotal = prevPaid.reduce((s, p) => s + (parseFloat(p.paidAmount ?? "0") || 0), 0);
    const prevDueRemaining = Math.max(0, prevYearDueTotal - prevPaidTotal);

    if (prevDueRemaining <= 0) {
      if (totalPaise <= 0) {
        return res.status(400).json({ error: "Previous year due is already fully paid." });
      }
    } else {
      const prevDueAmount = resolvePrevDueAmount(
        student.previousYearDueRemarks, prevDueRemaining, prevPaidTotal, prevDueMonths, includePrevDue,
      );
      if (prevDueAmount <= 0) {
        return res.status(400).json({ error: "Select at least one previous due month to pay." });
      }
      prevDueAmountPaise = Math.round(prevDueAmount * 100);
      totalPaise += prevDueAmountPaise;
      // Only keep the month tags if there's an actual breakdown to validate
      // against — this mirrors resolvePrevDueAmount's own gating so verify
      // later writes one tagged record per month (matching the admin panel's
      // own PYD-MONTH: tagging), or falls back to a single lump record.
      const remainingMonths = getPrevYearDueMonthsRemaining(student.previousYearDueRemarks, prevPaidTotal);
      if (remainingMonths.length > 0 && Array.isArray(prevDueMonths)) {
        const selected = new Set(prevDueMonths.map(m => Number(m)));
        resolvedPrevDueMonths = remainingMonths.filter(m => selected.has(m.month)).map(m => m.month);
      }
    }
  }

  if (totalPaise <= 0) {
    return res.status(400).json({ error: "All selected fees are already fully paid." });
  }

  try {
    const order = await rzp.client.orders.create({
      amount: totalPaise,
      currency: "INR",
      receipt: `RCPT-${studentId}-${Date.now()}`,
      notes: { studentId: String(studentId), session },
    });

    // Persist order context in DB (durable across restarts)
    await saveOrderContext(order.id, {
      studentId,
      classId,
      selections: selections ?? [],
      session,
      amountPaise: totalPaise,
      createdAt: Date.now(),
      includePrevDue: !!includePrevDue && prevDueAmountPaise > 0,
      prevDueAmountPaise,
      prevDueMonths: resolvedPrevDueMonths,
    });

    logger.info({ orderId: order.id, studentId, amountPaise: totalPaise }, "Razorpay order created");
    return res.json({ orderId: order.id, keyId: rzp.keyId, amount: totalPaise, currency: "INR" });
  } catch (err: any) {
    logger.error({ err: err.message }, "Razorpay order creation failed");
    return res.status(500).json({ error: "Failed to create payment order. Please try again." });
  }
});

// ─── POST /fees/payments/online-verify ── parent auth ────────────────────────
router.post("/fees/payments/online-verify", requireAuth("parent"), async (req, res) => {
  const parentId: number = (req as any).user.id;
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body as {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  };

  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
    return res.status(400).json({ error: "Missing payment verification fields" });
  }

  // Verify HMAC signature first
  const keySecret = await getSetting("razorpay_key_secret");
  if (!keySecret) return res.status(503).json({ error: "Payment gateway not configured" });

  const expectedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    logger.warn({ razorpay_order_id }, "Razorpay signature mismatch");
    return res.status(400).json({ error: "Payment verification failed — invalid signature" });
  }

  // Load and remove order context from DB
  const ctx = await loadOrderContext(razorpay_order_id);
  if (!ctx) {
    return res.status(400).json({ error: "Order context not found or expired. Please contact the school with your payment ID." });
  }

  const { studentId, classId, selections, session, includePrevDue, prevDueAmountPaise, prevDueMonths: ctxPrevDueMonths } = ctx;

  // Re-verify parent still owns the student (guards against token re-use)
  const owns = await parentOwnsStudent(parentId, studentId);
  if (!owns) {
    logger.warn({ parentId, studentId }, "Parent verify ownership mismatch");
    return res.status(403).json({ error: "Unauthorized" });
  }

  // Remove order context (idempotency: subsequent retries will hit 400)
  await deleteOrderContext(razorpay_order_id);

  const today = new Date().toISOString().split("T")[0];
  const receiptBase = `UPI-${razorpay_payment_id}`;

  // Idempotency guard: if payment rows for this Razorpay payment_id already
  // exist (e.g. a duplicate verify request arrived while the first was still
  // writing), return success immediately without double-posting. The receipt
  // number always starts with the unique payment_id so this check is stable.
  const alreadyRecorded = await db.select({ id: feePaymentsTable.id })
    .from(feePaymentsTable)
    .where(like(feePaymentsTable.receiptNo, `${receiptBase}%`))
    .limit(1);
  if (alreadyRecorded.length > 0) {
    logger.warn({ razorpay_payment_id, studentId }, "online-verify: payment already recorded — returning idempotent success");
    return res.json({ ok: true, receiptBase, monthsPaid: selections.length });
  }

  // Re-fetch fee structures from DB (with frequency — don't trust cached ctx)
  const [studentForVerify, structures] = await Promise.all([
    db.select({
      hasVehicle: studentsTable.hasVehicle,
      transportFromMonth: studentsTable.transportFromMonth,
      transportStopMonth: studentsTable.transportStopMonth,
      transportRoutePricePerMonth: transportRoutesTable.pricePerMonth,
      studentType: studentsTable.studentType,
      previousYearDueRemarks: studentsTable.previousYearDueRemarks,
    })
      .from(studentsTable)
      .leftJoin(transportRoutesTable, eq(studentsTable.transportRouteId, transportRoutesTable.id))
      .where(eq(studentsTable.id, studentId))
      .then(r => r[0] ?? null),
    db.select({
      categoryId: feeStructuresTable.categoryId,
      categoryName: feeCategoriesTable.name,
      amount: feeStructuresTable.amount,
      frequency: feeCategoriesTable.frequency,
    })
      .from(feeStructuresTable)
      .innerJoin(feeCategoriesTable, eq(feeStructuresTable.categoryId, feeCategoriesTable.id))
      .where(and(eq(feeStructuresTable.classId, classId), eq(feeStructuresTable.session, session))),
  ]);

  if (structures.length === 0) {
    logger.error({ studentId, session }, "Fee structures missing during verify — money captured but no records");
    return res.status(500).json({ error: "Fee structures not found. Please contact the school with your payment ID: " + razorpay_payment_id });
  }

  // Get existing payments for this student + session
  const existing = await db.select({
    id: feePaymentsTable.id,
    categoryId: feePaymentsTable.categoryId,
    month: feePaymentsTable.month,
    year: feePaymentsTable.year,
    amount: feePaymentsTable.amount,
    paidAmount: feePaymentsTable.paidAmount,
    discount: feePaymentsTable.discount,
    status: feePaymentsTable.status,
    isPreviousDue: feePaymentsTable.isPreviousDue,
  })
    .from(feePaymentsTable)
    .where(and(eq(feePaymentsTable.studentId, studentId), eq(feePaymentsTable.session, session)));

  // Separate tuition/non-transport structures so we can handle transport separately
  const tuitionStructs = structures.filter(s => {
    const cn = s.categoryName.toLowerCase();
    return !cn.includes("transport") && !cn.includes("bus");
  });
  const admissionCatId = structures.find(s => s.categoryName.toLowerCase().includes("admission"))?.categoryId ?? null;

  const toInsert: typeof feePaymentsTable.$inferInsert[] = [];
  const toUpdate: Array<{ id: number; paidAmount: string; status: string; paymentDate: string; paymentMethod: string; receiptNo: string; collectedBy: string }> = [];

  let idx = 0;
  for (const sel of selections) {
    const mIdx = schoolYearIdx(sel.month); // 0=Apr … 11=Mar

    // ── If a direct payment already exists for this month (e.g. admin
    // collected a partial amount in person), record this online payment as a
    // brand-new carry-forward-clearance entry instead of overwriting the
    // original record(s). This keeps the original receipt/receipt number
    // completely untouched and generates a separate new receipt for the
    // top-up — mirroring the admin panel's own "settle carry-forward
    // directly" flow (receiptNo suffix "-CFNOW", isPreviousDue: true), which
    // the admin UI already knows how to render with its own Receipt / Delete
    // CF Receipt buttons.
    const directRecsForMonth = existing.filter(p =>
      p.month === sel.month && p.year === sel.year && !p.isPreviousDue
    );
    if (directRecsForMonth.length > 0) {
      const total = directRecsForMonth.reduce((s, p) => s + parseFloat(p.amount ?? "0") - parseFloat(p.discount ?? "0"), 0);
      const directPaid = directRecsForMonth.reduce((s, p) => s + parseFloat(p.paidAmount ?? "0"), 0);
      const cfPaidSoFar = existing
        .filter(p => p.month === sel.month && p.year === sel.year && p.isPreviousDue)
        .reduce((s, p) => s + parseFloat(p.paidAmount ?? "0"), 0);
      const balance = Math.max(0, total - directPaid - cfPaidSoFar);
      if (balance > 0) {
        idx++;
        toInsert.push({
          studentId,
          categoryId: directRecsForMonth[0].categoryId,
          amount: String(balance),
          paidAmount: String(balance),
          discount: "0", fine: "0", status: "paid",
          month: sel.month, year: sel.year, session,
          paymentDate: today, paymentMethod: "upi",
          receiptNo: `${receiptBase}-${sel.month}-CFNOW`,
          remarks: `Carry-forward direct clearance for ${monthName(sel.month)} ${sel.year} — Online UPI payment`,
          isPreviousDue: true, previousSession: "",
          collectedBy: "Parent (UPI)",
        });
      }
      continue;
    }

    // ── No existing record for this month — first-time full-month payment ──
    for (const struct of tuitionStructs) {
      const freq = (struct.frequency || "monthly").toLowerCase();
      // Skip structures that don't apply to this month per frequency
      const applies =
        freq === "monthly" ? true :
        freq === "quarterly" ? mIdx % 3 === 0 :
        freq === "annually" ? mIdx === 0 :
        freq === "one-time" ? mIdx === 0 :
        true;
      // Admission fee: only for "new" students, only in April
      if (struct.categoryId === admissionCatId) {
        if (mIdx !== 0) continue;
        if (!(studentForVerify?.studentType ?? "").toLowerCase().trim().includes("new")) continue;
      }
      if (!applies) continue;

      idx++;
      const feeAmount = parseFloat(String(struct.amount ?? "0"));
      toInsert.push({
        studentId,
        categoryId: struct.categoryId,
        amount: String(feeAmount),
        paidAmount: String(feeAmount),
        discount: "0", fine: "0", status: "paid",
        month: sel.month, year: sel.year, session,
        paymentDate: today, paymentMethod: "upi",
        receiptNo: `${receiptBase}-${idx}`,
        remarks: "Online UPI payment",
        isPreviousDue: false, previousSession: "",
        collectedBy: "Parent (UPI)",
      });
    }

    // ── Transport fee recording ───────────────────────────────────────────────
    if (studentForVerify?.hasVehicle && studentForVerify?.transportRoutePricePerMonth) {
      const fromIdx = schoolYearIdx(studentForVerify.transportFromMonth ?? 4);
      const stopIdx = studentForVerify.transportStopMonth !== null
        ? schoolYearIdx(studentForVerify.transportStopMonth!)
        : -1;
      const transportApplies = mIdx >= fromIdx && (stopIdx < 0 || mIdx < stopIdx);

      if (transportApplies) {
        const routePrice = parseFloat(String(studentForVerify.transportRoutePricePerMonth)) || 0;
        // Get or create the transport fee category
        let [transportCat] = await db.select({ id: feeCategoriesTable.id })
          .from(feeCategoriesTable).where(ilike(feeCategoriesTable.name, "transport%")).limit(1);
        if (!transportCat) {
          [transportCat] = await db.insert(feeCategoriesTable).values({
            name: "Transport Fee", description: "Bus/Transport monthly fee", frequency: "monthly",
          }).returning({ id: feeCategoriesTable.id });
        }
        idx++;
        toInsert.push({
          studentId, categoryId: transportCat.id,
          amount: String(routePrice), paidAmount: String(routePrice),
          discount: "0", fine: "0", status: "paid",
          month: sel.month, year: sel.year, session,
          paymentDate: today, paymentMethod: "upi",
          receiptNo: `${receiptBase}-${idx}`,
          remarks: "Online UPI payment — transport",
          isPreviousDue: false, previousSession: "",
          collectedBy: "Parent (UPI)",
        });
      }
    }
  }

  // If prev year due was included, add a payment record for it. When the
  // student has a monthly breakdown and specific months were selected at
  // order time, write ONE tagged record per month using the exact
  // `PYD-MONTH:<n>` remarks convention and receipt suffix the admin panel's
  // own manual per-month settlement flow uses — this is what lets the admin
  // fee-collection page tick off the individual paid month(s) and print a
  // correct receipt for online payments. When there's no breakdown (legacy
  // lump case), fall back to a single lump record as before.
  if (includePrevDue && prevDueAmountPaise && prevDueAmountPaise > 0) {
    const prevDueAmount = prevDueAmountPaise / 100;
    const sessionYear = parseInt(String(session).slice(0, 4), 10) || new Date().getFullYear();

    let prevCatId = tuitionStructs[0]?.categoryId ?? null;
    if (!prevCatId) {
      let [transportCat] = await db.select({ id: feeCategoriesTable.id })
        .from(feeCategoriesTable).where(ilike(feeCategoriesTable.name, "transport%")).limit(1);
      if (!transportCat) {
        [transportCat] = await db.insert(feeCategoriesTable).values({
          name: "Transport Fee", description: "Bus/Transport monthly fee", frequency: "monthly",
        }).returning({ id: feeCategoriesTable.id });
      }
      prevCatId = transportCat?.id ?? null;
    }

    // Re-derive each selected month's remaining balance the same way order
    // creation did (no prev-due rows have been inserted between order
    // creation and this verify step, so paidSoFar is unchanged).
    const prevPaidSoFar = (await db.select({ paidAmount: feePaymentsTable.paidAmount })
      .from(feePaymentsTable)
      .where(and(eq(feePaymentsTable.studentId, studentId), eq(feePaymentsTable.isPreviousDue, true), eq(feePaymentsTable.month, 0))))
      .reduce((s, p) => s + (parseFloat(p.paidAmount ?? "0") || 0), 0);
    const remainingMonths = getPrevYearDueMonthsRemaining(
      studentForVerify?.previousYearDueRemarks ?? null,
      prevPaidSoFar,
    );
    const amountByMonth = new Map(remainingMonths.map(m => [m.month, m.amount]));

    // Per-month rows are only safe to write if their amounts, re-derived
    // fresh from the DB right now, sum to EXACTLY the amount Razorpay
    // actually captured (prevDueAmountPaise). If anything shifted between
    // order creation and verify (e.g. the student's due breakdown was
    // edited, or another payment landed in that window), the split would no
    // longer reconcile with the captured money — so we must never trust it
    // silently. In that case we fall back to a single lump record for the
    // full captured amount: money is never lost or double counted, only the
    // admin's individual per-month tick is deferred to manual reconciliation.
    const perMonthTotalPaise = ctxPrevDueMonths && ctxPrevDueMonths.length > 0
      ? Math.round(ctxPrevDueMonths.reduce((s, m) => s + (amountByMonth.get(m) ?? NaN), 0) * 100)
      : NaN;
    const perMonthReconciles = Number.isFinite(perMonthTotalPaise) && perMonthTotalPaise === prevDueAmountPaise;

    if (prevCatId && Array.isArray(ctxPrevDueMonths) && ctxPrevDueMonths.length > 0
      && ctxPrevDueMonths.every(m => amountByMonth.has(m)) && perMonthReconciles) {
      // One tagged record per selected month, matching each month's own
      // remaining balance exactly (sums to prevDueAmount, validated at order
      // creation time).
      for (const monthNum of ctxPrevDueMonths) {
        const monthAmt = amountByMonth.get(monthNum)!;
        toInsert.push({
          studentId,
          categoryId: prevCatId,
          amount: String(monthAmt),
          paidAmount: String(monthAmt),
          discount: "0",
          fine: "0",
          status: "paid",
          month: 0,
          year: sessionYear,
          session,
          paymentDate: today,
          paymentMethod: "upi",
          receiptNo: `${receiptBase}-PYD${monthNum}`,
          remarks: `PYD-MONTH:${monthNum} — Online UPI payment`,
          isPreviousDue: true,
          previousSession: "",
          collectedBy: "Parent (UPI)",
        });
      }
    } else {
      if (ctxPrevDueMonths && ctxPrevDueMonths.length > 0 && !perMonthReconciles) {
        logger.warn({ studentId, razorpay_order_id, ctxPrevDueMonths, prevDueAmountPaise, perMonthTotalPaise },
          "Previous-due month breakdown no longer reconciles with captured amount at verify time — recording as lump sum for manual admin reconciliation");
      }
      toInsert.push({
        studentId,
        categoryId: prevCatId ?? 0,
        amount: String(prevDueAmount),
        paidAmount: String(prevDueAmount),
        discount: "0",
        fine: "0",
        status: "paid",
        month: 0,
        year: sessionYear,
        session,
        paymentDate: today,
        paymentMethod: "upi",
        receiptNo: `${receiptBase}-PREVDUE`,
        remarks: "Previous year due — Online UPI payment",
        isPreviousDue: true,
        previousSession: "",
        collectedBy: "Parent (UPI)",
      });
    }
  }

  await db.transaction(async (tx) => {
    if (toInsert.length > 0) await tx.insert(feePaymentsTable).values(toInsert);
    for (const upd of toUpdate) {
      await tx.update(feePaymentsTable)
        .set({ paidAmount: upd.paidAmount, status: upd.status, paymentDate: upd.paymentDate, paymentMethod: upd.paymentMethod, receiptNo: upd.receiptNo, collectedBy: upd.collectedBy })
        .where(eq(feePaymentsTable.id, upd.id));
    }
  });

  logger.info({ razorpay_payment_id, studentId, session, monthsCount: selections.length, includePrevDue }, "Online payment recorded");

  // Fetch student for email
  const [studentInfo] = await db.select({
    studentName: studentsTable.studentName,
    rollNo: studentsTable.rollNo,
    parentEmail: studentsTable.parentEmail,
    className: classesTable.name,
  })
    .from(studentsTable)
    .innerJoin(classesTable, eq(studentsTable.classId, classesTable.id))
    .where(eq(studentsTable.id, studentId));

  // Send receipt email (non-blocking)
  if (studentInfo?.parentEmail) {
    (async () => {
      try {
        const mailer = await getMailer();
        if (!mailer) return;
        const schoolName = await getSetting("school_name").catch(() => "") || "School";
        const totalAmount = (ctx.amountPaise / 100).toFixed(2);
        const monthsList = selections.map(s => `${monthName(s.month)} ${s.year}`).join(", ");
        const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
<div style="max-width:580px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <div style="background:#0f766e;padding:24px 28px;text-align:center;">
    <h1 style="margin:0;color:#fff;font-size:20px;font-weight:bold;">${schoolName}</h1>
    <p style="margin:6px 0 0;color:#99f6e4;font-size:14px;">Online Fee Payment Confirmation</p>
  </div>
  <div style="padding:28px;">
    <p style="margin:0 0 16px;color:#334155;font-size:15px;">Dear Parent of <strong>${studentInfo.studentName}</strong>,</p>
    <p style="color:#64748b;font-size:14px;margin:0 0 20px;">Your UPI fee payment has been received successfully.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;color:#1e293b;">
      <tr style="background:#f0fdf4;"><td style="padding:10px 14px;border:1px solid #d1fae5;font-weight:600;">Payment ID</td><td style="padding:10px 14px;border:1px solid #d1fae5;font-family:monospace;">${razorpay_payment_id}</td></tr>
      <tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-weight:600;">Student</td><td style="padding:10px 14px;border:1px solid #e2e8f0;">${studentInfo.studentName}${studentInfo.rollNo ? ` (Roll: ${studentInfo.rollNo})` : ""}</td></tr>
      <tr style="background:#f8fafc;"><td style="padding:10px 14px;border:1px solid #e2e8f0;font-weight:600;">Class</td><td style="padding:10px 14px;border:1px solid #e2e8f0;">${studentInfo.className ?? "—"}</td></tr>
      <tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-weight:600;">Months Paid</td><td style="padding:10px 14px;border:1px solid #e2e8f0;">${monthsList}</td></tr>
      <tr style="background:#f8fafc;"><td style="padding:10px 14px;border:1px solid #e2e8f0;font-weight:600;">Amount Paid</td><td style="padding:10px 14px;border:1px solid #e2e8f0;color:#0f766e;font-weight:700;font-size:16px;">₹${totalAmount}</td></tr>
      <tr><td style="padding:10px 14px;border:1px solid #e2e8f0;font-weight:600;">Method</td><td style="padding:10px 14px;border:1px solid #e2e8f0;">UPI (Online)</td></tr>
      <tr style="background:#f8fafc;"><td style="padding:10px 14px;border:1px solid #e2e8f0;font-weight:600;">Date</td><td style="padding:10px 14px;border:1px solid #e2e8f0;">${today}</td></tr>
    </table>
    <p style="margin:20px 0 0;color:#64748b;font-size:13px;">Please keep this email as your payment record. The fee collection register has been updated automatically.</p>
  </div>
  <div style="padding:14px 28px;border-top:1px solid #e2e8f0;text-align:center;background:#f8fafc;">
    <p style="margin:0;color:#94a3b8;font-size:12px;">Automated receipt from ${schoolName}</p>
  </div>
</div>
</body></html>`;
        await mailer.transport.sendMail({
          from: `"${schoolName}" <${mailer.from}>`,
          to: studentInfo.parentEmail!,
          subject: `Fee Receipt — ${studentInfo.studentName} — ${monthsList} — ₹${totalAmount}`,
          html,
        });
        logger.info({ studentId }, "Online payment receipt email sent");
      } catch (err: any) {
        logger.warn({ err: err.message }, "Failed to send online payment receipt email");
      }
    })();
  }

  return res.json({ ok: true, receiptBase, monthsPaid: selections.length });
});

// ─── POST /fees/payments/public-order ── no auth, public fee payment ─────────
router.post("/fees/payments/public-order", async (req, res) => {
  const { studentId, selections, session, includePrevDue, prevDueMonths } = req.body as {
    studentId: number;
    selections: Array<{ month: number; year: number }>;
    session: string;
    includePrevDue?: boolean;
    prevDueMonths?: number[];
  };

  if (!studentId || !session) {
    return res.status(400).json({ error: "studentId and session are required" });
  }
  if (!selections?.length && !includePrevDue) {
    return res.status(400).json({ error: "Select at least one month or include previous year due" });
  }

  // Derive classId + transport info from DB
  const [student] = await db.select({
    classId: studentsTable.classId,
    hasVehicle: studentsTable.hasVehicle,
    transportFromMonth: studentsTable.transportFromMonth,
    transportStopMonth: studentsTable.transportStopMonth,
    transportRoutePricePerMonth: transportRoutesTable.pricePerMonth,
    studentType: studentsTable.studentType,
    previousYearDue: studentsTable.previousYearDue,
    previousYearDueRemarks: studentsTable.previousYearDueRemarks,
  })
    .from(studentsTable)
    .leftJoin(transportRoutesTable, eq(studentsTable.transportRouteId, transportRoutesTable.id))
    .where(eq(studentsTable.id, studentId));
  if (!student?.classId) {
    return res.status(400).json({ error: "Student class information not found." });
  }
  const classId = student.classId;

  const rzp = await getRazorpayClient();
  if (!rzp) return res.status(503).json({ error: "Online payment is not configured. Please contact the school." });

  // Get fee structures for this class + session (with frequency)
  const structures = await db.select({
    categoryId: feeStructuresTable.categoryId,
    categoryName: feeCategoriesTable.name,
    amount: feeStructuresTable.amount,
    frequency: feeCategoriesTable.frequency,
  })
    .from(feeStructuresTable)
    .innerJoin(feeCategoriesTable, eq(feeStructuresTable.categoryId, feeCategoriesTable.id))
    .where(and(eq(feeStructuresTable.classId, classId), eq(feeStructuresTable.session, session)));

  if (structures.length === 0) {
    return res.status(400).json({ error: "No fee structure found for this class and session." });
  }

  const admissionCatId = structures.find(s => s.categoryName.toLowerCase().includes("admission"))?.categoryId ?? null;

  const existing = await db.select({
    categoryId: feePaymentsTable.categoryId,
    month: feePaymentsTable.month,
    year: feePaymentsTable.year,
    amount: feePaymentsTable.amount,
    paidAmount: feePaymentsTable.paidAmount,
    discount: feePaymentsTable.discount,
    status: feePaymentsTable.status,
    isPreviousDue: feePaymentsTable.isPreviousDue,
  })
    .from(feePaymentsTable)
    .where(and(eq(feePaymentsTable.studentId, studentId), eq(feePaymentsTable.session, session)));

  // Calculate payable amount using shared helper (frequency + transport + admission aware)
  let totalPaise = computeSelectionPaise(selections ?? [], structures, existing, student, admissionCatId);

  let prevDueAmountPaise = 0;
  let resolvedPrevDueMonths: number[] = [];
  if (includePrevDue) {
    const prevYearDueTotal = parseFloat(String(student.previousYearDue ?? "0")) || 0;
    // Only count month-0 "previous year due" settlement rows — see comment
    // in the online-order endpoint above for why CF clearance rows are excluded.
    const prevPaid = await db.select({ paidAmount: feePaymentsTable.paidAmount })
      .from(feePaymentsTable)
      .where(and(eq(feePaymentsTable.studentId, studentId), eq(feePaymentsTable.isPreviousDue, true), eq(feePaymentsTable.month, 0)));
    const prevPaidTotal = prevPaid.reduce((s, p) => s + (parseFloat(p.paidAmount ?? "0") || 0), 0);
    const prevDueRemaining = Math.max(0, prevYearDueTotal - prevPaidTotal);
    if (prevDueRemaining > 0) {
      const prevDueAmount = resolvePrevDueAmount(
        student.previousYearDueRemarks, prevDueRemaining, prevPaidTotal, prevDueMonths, includePrevDue,
      );
      if (prevDueAmount <= 0) {
        return res.status(400).json({ error: "Select at least one previous due month to pay." });
      }
      prevDueAmountPaise = Math.round(prevDueAmount * 100);
      totalPaise += prevDueAmountPaise;
      // Keep the month tags only if there's an actual breakdown to validate
      // against, mirroring resolvePrevDueAmount's own gating — verify then
      // writes one PYD-MONTH:-tagged record per month (matching the admin
      // panel's own manual per-month settlement format), or a single lump
      // record when there's no breakdown.
      const remainingMonths = getPrevYearDueMonthsRemaining(student.previousYearDueRemarks, prevPaidTotal);
      if (remainingMonths.length > 0 && Array.isArray(prevDueMonths)) {
        const selected = new Set(prevDueMonths.map(m => Number(m)));
        resolvedPrevDueMonths = remainingMonths.filter(m => selected.has(m.month)).map(m => m.month);
      }
    }
  }

  if (totalPaise <= 0) {
    return res.status(400).json({ error: "All selected fees are already fully paid." });
  }

  try {
    const order = await rzp.client.orders.create({
      amount: totalPaise,
      currency: "INR",
      receipt: `RCPT-${studentId}-${Date.now()}`,
      notes: { studentId: String(studentId), session },
    });

    await saveOrderContext(order.id, {
      studentId,
      classId,
      selections: selections ?? [],
      session,
      amountPaise: totalPaise,
      createdAt: Date.now(),
      includePrevDue: !!includePrevDue && prevDueAmountPaise > 0,
      prevDueAmountPaise,
      prevDueMonths: resolvedPrevDueMonths,
    });

    logger.info({ orderId: order.id, studentId, amountPaise: totalPaise }, "Public Razorpay order created");
    return res.json({ orderId: order.id, keyId: rzp.keyId, amount: totalPaise, currency: "INR" });
  } catch (err: any) {
    logger.error({ err: err.message }, "Razorpay public order creation failed");
    return res.status(500).json({ error: "Failed to create payment order. Please try again." });
  }
});

// ─── POST /fees/payments/public-verify ── no auth, public fee payment verify ──
router.post("/fees/payments/public-verify", async (req, res) => {
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body as {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  };

  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
    return res.status(400).json({ error: "Missing payment verification fields" });
  }

  const keySecret = await getSetting("razorpay_key_secret");
  if (!keySecret) return res.status(503).json({ error: "Payment gateway not configured" });

  const expectedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    logger.warn({ razorpay_order_id }, "Public Razorpay signature mismatch");
    return res.status(400).json({ error: "Payment verification failed — invalid signature" });
  }

  const ctx = await loadOrderContext(razorpay_order_id);
  if (!ctx) {
    return res.status(400).json({ error: "Order context not found or expired. Please contact the school with your payment ID." });
  }

  const { studentId, classId, selections, session, includePrevDue, prevDueAmountPaise, prevDueMonths: ctxPrevDueMonths } = ctx;
  await deleteOrderContext(razorpay_order_id);

  const today = new Date().toISOString().split("T")[0];
  const receiptBase = `UPI-${razorpay_payment_id}`;

  // Idempotency guard — mirrors the same check in online-verify.
  const alreadyRecordedPub = await db.select({ id: feePaymentsTable.id })
    .from(feePaymentsTable)
    .where(like(feePaymentsTable.receiptNo, `${receiptBase}%`))
    .limit(1);
  if (alreadyRecordedPub.length > 0) {
    logger.warn({ razorpay_payment_id, studentId }, "public-verify: payment already recorded — returning idempotent success");
    return res.json({ ok: true, receiptBase, monthsPaid: selections.length });
  }

  const [studentForPublicVerify, structures] = await Promise.all([
    db.select({
      hasVehicle: studentsTable.hasVehicle,
      transportFromMonth: studentsTable.transportFromMonth,
      transportStopMonth: studentsTable.transportStopMonth,
      transportRoutePricePerMonth: transportRoutesTable.pricePerMonth,
      studentType: studentsTable.studentType,
      previousYearDueRemarks: studentsTable.previousYearDueRemarks,
    })
      .from(studentsTable)
      .leftJoin(transportRoutesTable, eq(studentsTable.transportRouteId, transportRoutesTable.id))
      .where(eq(studentsTable.id, studentId))
      .then(r => r[0] ?? null),
    db.select({
      categoryId: feeStructuresTable.categoryId,
      categoryName: feeCategoriesTable.name,
      amount: feeStructuresTable.amount,
      frequency: feeCategoriesTable.frequency,
    })
      .from(feeStructuresTable)
      .innerJoin(feeCategoriesTable, eq(feeStructuresTable.categoryId, feeCategoriesTable.id))
      .where(and(eq(feeStructuresTable.classId, classId), eq(feeStructuresTable.session, session))),
  ]);

  if (structures.length === 0) {
    return res.status(500).json({ error: "Fee structures not found. Please contact the school with your payment ID: " + razorpay_payment_id });
  }

  const existing = await db.select({
    id: feePaymentsTable.id,
    categoryId: feePaymentsTable.categoryId,
    month: feePaymentsTable.month,
    year: feePaymentsTable.year,
    amount: feePaymentsTable.amount,
    paidAmount: feePaymentsTable.paidAmount,
    discount: feePaymentsTable.discount,
    status: feePaymentsTable.status,
    isPreviousDue: feePaymentsTable.isPreviousDue,
  })
    .from(feePaymentsTable)
    .where(and(eq(feePaymentsTable.studentId, studentId), eq(feePaymentsTable.session, session)));

  const tuitionStructsPub = structures.filter(s => {
    const cn = s.categoryName.toLowerCase();
    return !cn.includes("transport") && !cn.includes("bus");
  });
  const admissionCatIdPub = structures.find(s => s.categoryName.toLowerCase().includes("admission"))?.categoryId ?? null;

  const toInsert: typeof feePaymentsTable.$inferInsert[] = [];
  const toUpdate: Array<{ id: number; paidAmount: string; status: string; paymentDate: string; paymentMethod: string; receiptNo: string; collectedBy: string }> = [];

  let idx = 0;
  for (const sel of selections) {
    const mIdx = schoolYearIdx(sel.month);

    // ── If a direct payment already exists for this month (e.g. admin
    // collected a partial amount in person), record this online payment as a
    // brand-new carry-forward-clearance entry instead of overwriting the
    // original record(s) — see matching comment in online-verify above.
    const directRecsForMonthPub = existing.filter(p =>
      p.month === sel.month && p.year === sel.year && !p.isPreviousDue
    );
    if (directRecsForMonthPub.length > 0) {
      const total = directRecsForMonthPub.reduce((s, p) => s + parseFloat(p.amount ?? "0") - parseFloat(p.discount ?? "0"), 0);
      const directPaid = directRecsForMonthPub.reduce((s, p) => s + parseFloat(p.paidAmount ?? "0"), 0);
      const cfPaidSoFar = existing
        .filter(p => p.month === sel.month && p.year === sel.year && p.isPreviousDue)
        .reduce((s, p) => s + parseFloat(p.paidAmount ?? "0"), 0);
      const balance = Math.max(0, total - directPaid - cfPaidSoFar);
      if (balance > 0) {
        idx++;
        toInsert.push({
          studentId,
          categoryId: directRecsForMonthPub[0].categoryId,
          amount: String(balance),
          paidAmount: String(balance),
          discount: "0", fine: "0", status: "paid",
          month: sel.month, year: sel.year, session,
          paymentDate: today, paymentMethod: "upi",
          receiptNo: `${receiptBase}-${sel.month}-CFNOW`,
          remarks: `Carry-forward direct clearance for ${monthName(sel.month)} ${sel.year} — Online UPI payment (public)`,
          isPreviousDue: true, previousSession: "",
          collectedBy: "Parent (UPI)",
        });
      }
      continue;
    }

    // ── No existing record for this month — first-time full-month payment ──
    for (const struct of tuitionStructsPub) {
      const freq = (struct.frequency || "monthly").toLowerCase();
      const applies =
        freq === "monthly" ? true :
        freq === "quarterly" ? mIdx % 3 === 0 :
        freq === "annually" ? mIdx === 0 :
        freq === "one-time" ? mIdx === 0 :
        true;
      if (struct.categoryId === admissionCatIdPub) {
        if (mIdx !== 0) continue;
        if (!(studentForPublicVerify?.studentType ?? "").toLowerCase().trim().includes("new")) continue;
      }
      if (!applies) continue;

      idx++;
      const feeAmount = parseFloat(String(struct.amount ?? "0"));
      toInsert.push({
        studentId, categoryId: struct.categoryId, amount: String(feeAmount),
        paidAmount: String(feeAmount), discount: "0", fine: "0", status: "paid",
        month: sel.month, year: sel.year, session, paymentDate: today,
        paymentMethod: "upi", receiptNo: `${receiptBase}-${idx}`,
        remarks: "Online UPI payment (public)", isPreviousDue: false,
        previousSession: "", collectedBy: "Parent (UPI)",
      });
    }

    // ── Transport fee recording ───────────────────────────────────────────────
    if (studentForPublicVerify?.hasVehicle && studentForPublicVerify?.transportRoutePricePerMonth) {
      const fromIdx = schoolYearIdx(studentForPublicVerify.transportFromMonth ?? 4);
      const stopIdx = studentForPublicVerify.transportStopMonth !== null
        ? schoolYearIdx(studentForPublicVerify.transportStopMonth!)
        : -1;
      const transportApplies = mIdx >= fromIdx && (stopIdx < 0 || mIdx < stopIdx);

      if (transportApplies) {
        const routePrice = parseFloat(String(studentForPublicVerify.transportRoutePricePerMonth)) || 0;
        let [transportCat] = await db.select({ id: feeCategoriesTable.id })
          .from(feeCategoriesTable).where(ilike(feeCategoriesTable.name, "transport%")).limit(1);
        if (!transportCat) {
          [transportCat] = await db.insert(feeCategoriesTable).values({
            name: "Transport Fee", description: "Bus/Transport monthly fee", frequency: "monthly",
          }).returning({ id: feeCategoriesTable.id });
        }
        idx++;
        toInsert.push({
          studentId, categoryId: transportCat.id,
          amount: String(routePrice), paidAmount: String(routePrice),
          discount: "0", fine: "0", status: "paid",
          month: sel.month, year: sel.year, session,
          paymentDate: today, paymentMethod: "upi",
          receiptNo: `${receiptBase}-${idx}`,
          remarks: "Online UPI payment (public) — transport",
          isPreviousDue: false, previousSession: "",
          collectedBy: "Parent (UPI)",
        });
      }
    }
  }

  // See matching comment in online-verify above for why per-month tagged
  // records (PYD-MONTH:<n>) are required for the admin panel to tick off
  // individual months and print correct receipts.
  if (includePrevDue && prevDueAmountPaise && prevDueAmountPaise > 0) {
    const prevDueAmount = prevDueAmountPaise / 100;
    const sessionYear = parseInt(String(session).slice(0, 4), 10) || new Date().getFullYear();

    let prevCatId = tuitionStructsPub[0]?.categoryId ?? null;
    if (!prevCatId) {
      let [transportCat] = await db.select({ id: feeCategoriesTable.id })
        .from(feeCategoriesTable).where(ilike(feeCategoriesTable.name, "transport%")).limit(1);
      if (!transportCat) {
        [transportCat] = await db.insert(feeCategoriesTable).values({
          name: "Transport Fee", description: "Bus/Transport monthly fee", frequency: "monthly",
        }).returning({ id: feeCategoriesTable.id });
      }
      prevCatId = transportCat?.id ?? null;
    }

    const prevPaidSoFarPub = (await db.select({ paidAmount: feePaymentsTable.paidAmount })
      .from(feePaymentsTable)
      .where(and(eq(feePaymentsTable.studentId, studentId), eq(feePaymentsTable.isPreviousDue, true), eq(feePaymentsTable.month, 0))))
      .reduce((s, p) => s + (parseFloat(p.paidAmount ?? "0") || 0), 0);
    const remainingMonthsPub = getPrevYearDueMonthsRemaining(
      studentForPublicVerify?.previousYearDueRemarks ?? null,
      prevPaidSoFarPub,
    );
    const amountByMonthPub = new Map(remainingMonthsPub.map(m => [m.month, m.amount]));

    // See matching comment in online-verify above: never trust a per-month
    // split that doesn't reconcile exactly with the amount actually captured.
    const perMonthTotalPaisePub = ctxPrevDueMonths && ctxPrevDueMonths.length > 0
      ? Math.round(ctxPrevDueMonths.reduce((s, m) => s + (amountByMonthPub.get(m) ?? NaN), 0) * 100)
      : NaN;
    const perMonthReconcilesPub = Number.isFinite(perMonthTotalPaisePub) && perMonthTotalPaisePub === prevDueAmountPaise;

    if (prevCatId && Array.isArray(ctxPrevDueMonths) && ctxPrevDueMonths.length > 0
      && ctxPrevDueMonths.every(m => amountByMonthPub.has(m)) && perMonthReconcilesPub) {
      for (const monthNum of ctxPrevDueMonths) {
        const monthAmt = amountByMonthPub.get(monthNum)!;
        toInsert.push({
          studentId, categoryId: prevCatId, amount: String(monthAmt), paidAmount: String(monthAmt),
          discount: "0", fine: "0", status: "paid", month: 0, year: sessionYear, session,
          paymentDate: today, paymentMethod: "upi", receiptNo: `${receiptBase}-PYD${monthNum}`,
          remarks: `PYD-MONTH:${monthNum} — Online UPI payment (public)`,
          isPreviousDue: true, previousSession: "", collectedBy: "Parent (UPI)",
        });
      }
    } else {
      if (ctxPrevDueMonths && ctxPrevDueMonths.length > 0 && !perMonthReconcilesPub) {
        logger.warn({ studentId, razorpay_order_id, ctxPrevDueMonths, prevDueAmountPaise, perMonthTotalPaisePub },
          "Previous-due month breakdown no longer reconciles with captured amount at verify time (public) — recording as lump sum for manual admin reconciliation");
      }
      toInsert.push({
        studentId, categoryId: prevCatId ?? 0, amount: String(prevDueAmount), paidAmount: String(prevDueAmount),
        discount: "0", fine: "0", status: "paid", month: 0, year: sessionYear, session,
        paymentDate: today, paymentMethod: "upi", receiptNo: `${receiptBase}-PREVDUE`,
        remarks: "Previous year due — Online UPI payment (public)",
        isPreviousDue: true, previousSession: "", collectedBy: "Parent (UPI)",
      });
    }
  }

  await db.transaction(async (tx) => {
    if (toInsert.length > 0) await tx.insert(feePaymentsTable).values(toInsert);
    for (const upd of toUpdate) {
      await tx.update(feePaymentsTable)
        .set({ paidAmount: upd.paidAmount, status: upd.status, paymentDate: upd.paymentDate, paymentMethod: upd.paymentMethod, receiptNo: upd.receiptNo, collectedBy: upd.collectedBy })
        .where(eq(feePaymentsTable.id, upd.id));
    }
  });

  logger.info({ razorpay_payment_id, studentId, session, monthsCount: selections.length }, "Public online payment recorded");
  return res.json({ ok: true, receiptBase, monthsPaid: selections.length });
});

// ─── POST /webhooks/razorpay ── Razorpay server-to-server webhook (backup) ───
router.post("/webhooks/razorpay", async (req, res) => {
  const webhookSecret = await getSetting("razorpay_webhook_secret").catch(() => "");
  if (webhookSecret) {
    const signature = req.headers["x-razorpay-signature"] as string;
    const body = JSON.stringify(req.body);
    const expected = crypto.createHmac("sha256", webhookSecret).update(body).digest("hex");
    if (signature !== expected) {
      return res.status(400).json({ error: "Invalid webhook signature" });
    }
  }
  logger.info({ event: req.body?.event }, "Razorpay webhook received");
  return res.json({ ok: true });
});

export default router;
