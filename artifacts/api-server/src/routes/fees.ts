import { Router } from "express";
import { db, feeCategoriesTable, feeStructuresTable, feePaymentsTable, studentsTable, classesTable, sectionsTable } from "@workspace/db";
import { eq, and, inArray, desc, sql, ilike } from "drizzle-orm";
import { logger } from "../lib/logger";
import nodemailer from "nodemailer";

const router = Router();

function fmtDate(d: string | null | undefined): string {
  if (!d) return d ?? "—";
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : d;
}

async function getSetting(key: string): Promise<string> {
  const { appSettingsTable } = await import("@workspace/db");
  const rows = await db.select({ value: appSettingsTable.value }).from(appSettingsTable).where(eq(appSettingsTable.key, key));
  return rows[0]?.value ?? "";
}

async function getSchoolInfo(): Promise<{ name: string; address: string; phone: string; email: string }> {
  const { appSettingsTable } = await import("@workspace/db");
  const rows = await db.select({ key: appSettingsTable.key, value: appSettingsTable.value })
    .from(appSettingsTable)
    .where(inArray(appSettingsTable.key, ["school_name", "school_address", "school_contact_number", "school_email"]));
  const m = Object.fromEntries(rows.map(r => [r.key, r.value]));
  return { name: m["school_name"] || "", address: m["school_address"] || "", phone: m["school_contact_number"] || "", email: m["school_email"] || "" };
}

async function getMailer() {
  const gmailUser = process.env.GMAIL_USER || await getSetting("gmail_user");
  const gmailPass = (process.env.GMAIL_APP_PASSWORD || await getSetting("gmail_app_password")).replace(/\s/g, "");
  if (!gmailUser || !gmailPass) return null;
  return {
    transport: nodemailer.createTransport({
      host: "smtp.gmail.com", port: 587, secure: false,
      auth: { user: gmailUser, pass: gmailPass },
      tls: { rejectUnauthorized: false },
    }),
    from: gmailUser,
  };
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function monthName(m: number) { return MONTHS[(m - 1) % 12] || String(m); }

// ─── Categories ────────────────────────────────────────────────

router.get("/fees/categories", async (_req, res) => {
  const cats = await db.select().from(feeCategoriesTable).orderBy(feeCategoriesTable.id);
  res.json(cats.map(c => ({ ...c, createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt })));
});

router.post("/fees/categories", async (req, res) => {
  const { name, description, frequency } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "name is required" });
  const [cat] = await db.insert(feeCategoriesTable).values({
    name: name.trim(),
    description: description?.trim() ?? "",
    frequency: frequency ?? "monthly",
  }).returning();
  return res.status(201).json({ ...cat, createdAt: cat.createdAt.toISOString() });
});

router.patch("/fees/categories/:id", async (req, res) => {
  const id = parseInt(req.params['id'] as string, 10);
  if (isNaN(id)) return res.status(400).json({ error: "invalid id" });
  const { name, description, frequency } = req.body;
  const updates: any = {};
  if (name) updates.name = name.trim();
  if (description !== undefined) updates.description = description.trim();
  if (frequency) updates.frequency = frequency;
  const [cat] = await db.update(feeCategoriesTable).set(updates).where(eq(feeCategoriesTable.id, id)).returning();
  return res.json({ ...cat, createdAt: cat.createdAt.toISOString() });
});

router.delete("/fees/categories/:id", async (req, res) => {
  const id = parseInt(req.params['id'] as string, 10);
  if (isNaN(id)) return res.status(400).json({ error: "invalid id" });
  await db.delete(feeCategoriesTable).where(eq(feeCategoriesTable.id, id));
  return res.status(204).end();
});

// ─── Fee Structures ────────────────────────────────────────────

router.get("/fees/structures", async (req, res) => {
  const { classId, session } = req.query;
  const rows = await db.select({
    id: feeStructuresTable.id,
    classId: feeStructuresTable.classId,
    className: classesTable.name,
    categoryId: feeStructuresTable.categoryId,
    categoryName: feeCategoriesTable.name,
    frequency: feeCategoriesTable.frequency,
    amount: feeStructuresTable.amount,
    session: feeStructuresTable.session,
    dueDay: feeStructuresTable.dueDay,
  })
    .from(feeStructuresTable)
    .leftJoin(classesTable, eq(feeStructuresTable.classId, classesTable.id))
    .leftJoin(feeCategoriesTable, eq(feeStructuresTable.categoryId, feeCategoriesTable.id))
    .orderBy(feeStructuresTable.classId, feeStructuresTable.categoryId);

  let filtered = rows;
  if (classId) { const cId = parseInt(classId as string, 10); if (!isNaN(cId)) filtered = filtered.filter(r => r.classId === cId); }
  if (session && typeof session === "string" && session.trim()) filtered = filtered.filter(r => r.session === session.trim());

  res.json(filtered.map(r => ({ ...r, amount: parseFloat(r.amount ?? "0") })));
});

router.post("/fees/structures", async (req, res) => {
  const { classId, categoryId, amount, session, dueDay } = req.body;
  if (!classId || !categoryId || amount == null || !session) {
    return res.status(400).json({ error: "classId, categoryId, amount, session are required" });
  }
  // Upsert: delete existing matching record then insert
  await db.delete(feeStructuresTable).where(
    and(eq(feeStructuresTable.classId, parseInt(classId, 10)), eq(feeStructuresTable.categoryId, parseInt(categoryId, 10)), eq(feeStructuresTable.session, String(session)))
  );
  const [struct] = await db.insert(feeStructuresTable).values({
    classId: parseInt(classId, 10),
    categoryId: parseInt(categoryId, 10),
    amount: String(parseFloat(amount)),
    session: String(session),
    dueDay: dueDay ? parseInt(dueDay, 10) : 10,
  }).returning();

  const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, struct.classId));
  const [cat] = await db.select().from(feeCategoriesTable).where(eq(feeCategoriesTable.id, struct.categoryId));
  return res.json({
    ...struct,
    className: cls?.name ?? "",
    categoryName: cat?.name ?? "",
    amount: parseFloat(struct.amount ?? "0"),
  });
});

router.patch("/fees/structures/:id", async (req, res) => {
  const id = parseInt(req.params['id'] as string, 10);
  if (isNaN(id)) return res.status(400).json({ error: "invalid id" });
  const { amount, dueDay } = req.body;
  const updates: any = {};
  if (amount != null) updates.amount = String(parseFloat(amount));
  if (dueDay != null) updates.dueDay = parseInt(dueDay, 10);
  const [struct] = await db.update(feeStructuresTable).set(updates).where(eq(feeStructuresTable.id, id)).returning();
  if (!struct) return res.status(404).json({ error: "not found" });
  const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, struct.classId));
  const [cat] = await db.select().from(feeCategoriesTable).where(eq(feeCategoriesTable.id, struct.categoryId));
  return res.json({ ...struct, className: cls?.name ?? "", categoryName: cat?.name ?? "", amount: parseFloat(struct.amount ?? "0") });
});

router.delete("/fees/structures/:id", async (req, res) => {
  const id = parseInt(req.params['id'] as string, 10);
  if (isNaN(id)) return res.status(400).json({ error: "invalid id" });
  await db.delete(feeStructuresTable).where(eq(feeStructuresTable.id, id));
  return res.status(204).end();
});

// ─── Fee Payments ──────────────────────────────────────────────

function toPaymentResponse(row: any) {
  return {
    ...row,
    amount: parseFloat(row.amount ?? "0"),
    paidAmount: parseFloat(row.paidAmount ?? "0"),
    discount: parseFloat(row.discount ?? "0"),
    fine: parseFloat(row.fine ?? "0"),
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    paymentDate: row.paymentDate ?? null,
  };
}

router.get("/fees/payments", async (req, res) => {
  const { studentId, classId, sectionId, month, year, status, session } = req.query;

  const rows = await db.select({
    id: feePaymentsTable.id,
    studentId: feePaymentsTable.studentId,
    studentName: studentsTable.studentName,
    rollNo: studentsTable.rollNo,
    fatherName: studentsTable.fatherName,
    parentEmail: studentsTable.parentEmail,
    whatsappNumber: studentsTable.whatsappNumber,
    classId: studentsTable.classId,
    className: classesTable.name,
    sectionId: studentsTable.sectionId,
    sectionName: sectionsTable.name,
    categoryId: feePaymentsTable.categoryId,
    categoryName: feeCategoriesTable.name,
    amount: feePaymentsTable.amount,
    paidAmount: feePaymentsTable.paidAmount,
    discount: feePaymentsTable.discount,
    fine: feePaymentsTable.fine,
    status: feePaymentsTable.status,
    month: feePaymentsTable.month,
    year: feePaymentsTable.year,
    session: feePaymentsTable.session,
    paymentDate: feePaymentsTable.paymentDate,
    paymentMethod: feePaymentsTable.paymentMethod,
    receiptNo: feePaymentsTable.receiptNo,
    remarks: feePaymentsTable.remarks,
    isPreviousDue: feePaymentsTable.isPreviousDue,
    previousSession: feePaymentsTable.previousSession,
    collectedBy: feePaymentsTable.collectedBy,
    createdAt: feePaymentsTable.createdAt,
  })
    .from(feePaymentsTable)
    .leftJoin(studentsTable, eq(feePaymentsTable.studentId, studentsTable.id))
    .leftJoin(classesTable, eq(studentsTable.classId, classesTable.id))
    .leftJoin(sectionsTable, eq(studentsTable.sectionId, sectionsTable.id))
    .leftJoin(feeCategoriesTable, eq(feePaymentsTable.categoryId, feeCategoriesTable.id))
    .orderBy(desc(feePaymentsTable.createdAt));

  let filtered = rows;
  if (studentId) { const sId = parseInt(studentId as string, 10); if (!isNaN(sId)) filtered = filtered.filter(r => r.studentId === sId); }
  if (classId)   { const cId = parseInt(classId as string, 10);   if (!isNaN(cId)) filtered = filtered.filter(r => r.classId === cId); }
  if (sectionId) { const sid = parseInt(sectionId as string, 10); if (!isNaN(sid)) filtered = filtered.filter(r => r.sectionId === sid); }
  if (month)     { const m   = parseInt(month as string, 10);     if (!isNaN(m))   filtered = filtered.filter(r => r.month === m); }
  if (year)      { const y   = parseInt(year as string, 10);      if (!isNaN(y))   filtered = filtered.filter(r => r.year === y); }
  if (status && status !== "all") filtered = filtered.filter(r => r.status === status);
  if (session && typeof session === "string" && session.trim()) filtered = filtered.filter(r => r.session === session.trim());

  return res.json(filtered.map(toPaymentResponse));
});

router.post("/fees/payments", async (req, res) => {
  const { studentId, categoryId, amount, paidAmount, discount, fine, status, month, year, session,
          paymentDate, paymentMethod, receiptNo, remarks, isPreviousDue, previousSession, collectedBy, sendReceipt } = req.body;

  if (!studentId || !categoryId || amount == null || paidAmount == null || !status || month == null || !year || !session) {
    return res.status(400).json({ error: "studentId, categoryId, amount, paidAmount, status, month, year, session are required" });
  }

  const [payment] = await db.insert(feePaymentsTable).values({
    studentId: parseInt(studentId, 10),
    categoryId: parseInt(categoryId, 10),
    amount: String(parseFloat(amount)),
    paidAmount: String(parseFloat(paidAmount)),
    discount: String(parseFloat(discount ?? 0)),
    fine: String(parseFloat(fine ?? 0)),
    status,
    month: parseInt(month, 10),
    year: parseInt(year, 10),
    session: String(session),
    paymentDate: paymentDate ?? null,
    paymentMethod: paymentMethod ?? "cash",
    receiptNo: receiptNo ?? "",
    remarks: remarks ?? "",
    isPreviousDue: !!isPreviousDue,
    previousSession: previousSession ?? "",
    collectedBy: collectedBy ?? "",
  }).returning();

  // Fetch full row
  const [full] = await db.select({
    id: feePaymentsTable.id,
    studentId: feePaymentsTable.studentId,
    studentName: studentsTable.studentName,
    rollNo: studentsTable.rollNo,
    fatherName: studentsTable.fatherName,
    parentEmail: studentsTable.parentEmail,
    whatsappNumber: studentsTable.whatsappNumber,
    classId: studentsTable.classId,
    className: classesTable.name,
    sectionId: studentsTable.sectionId,
    sectionName: sectionsTable.name,
    categoryId: feePaymentsTable.categoryId,
    categoryName: feeCategoriesTable.name,
    amount: feePaymentsTable.amount,
    paidAmount: feePaymentsTable.paidAmount,
    discount: feePaymentsTable.discount,
    fine: feePaymentsTable.fine,
    status: feePaymentsTable.status,
    month: feePaymentsTable.month,
    year: feePaymentsTable.year,
    session: feePaymentsTable.session,
    paymentDate: feePaymentsTable.paymentDate,
    paymentMethod: feePaymentsTable.paymentMethod,
    receiptNo: feePaymentsTable.receiptNo,
    remarks: feePaymentsTable.remarks,
    isPreviousDue: feePaymentsTable.isPreviousDue,
    previousSession: feePaymentsTable.previousSession,
    collectedBy: feePaymentsTable.collectedBy,
    createdAt: feePaymentsTable.createdAt,
  })
    .from(feePaymentsTable)
    .leftJoin(studentsTable, eq(feePaymentsTable.studentId, studentsTable.id))
    .leftJoin(classesTable, eq(studentsTable.classId, classesTable.id))
    .leftJoin(sectionsTable, eq(studentsTable.sectionId, sectionsTable.id))
    .leftJoin(feeCategoriesTable, eq(feePaymentsTable.categoryId, feeCategoriesTable.id))
    .where(eq(feePaymentsTable.id, payment.id));

  // Send receipt email if requested and paid
  if (sendReceipt && full.parentEmail && status === "paid") {
    try {
      const mailer = await getMailer();
      if (mailer) {
        const school = await getSchoolInfo().catch(() => ({ name: "", address: "", phone: "", email: "" }));
        const sName = school.name || "School";
        const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
<div style="max-width:560px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
<div style="background:#0f766e;padding:20px 28px;text-align:center;">
<h1 style="margin:0;color:#fff;font-size:18px;font-weight:bold;">${sName}</h1>
<p style="margin:4px 0 0;color:#99f6e4;font-size:13px;">Fee Receipt</p>
</div>
<div style="padding:24px 28px;">
<p style="margin:0 0 16px;color:#334155;font-size:15px;">Dear Parent of <strong>${full.studentName}</strong>,</p>
<p style="color:#64748b;font-size:14px;margin:0 0 16px;">This is to confirm that your fee payment has been received.</p>
<table style="width:100%;border-collapse:collapse;font-size:14px;color:#1e293b;">
<tr style="background:#f8fafc;"><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;">Receipt No.</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">${full.receiptNo || `RCP-${full.id}`}</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;">Student</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">${full.studentName} (Roll: ${full.rollNo})</td></tr>
<tr style="background:#f8fafc;"><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;">Class</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">${full.className} – ${full.sectionName}</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;">Fee Type</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">${full.categoryName}</td></tr>
<tr style="background:#f8fafc;"><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;">Month</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">${monthName(full.month)} ${full.year}</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;">Amount Paid</td><td style="padding:8px 12px;border:1px solid #e2e8f0;color:#0f766e;font-weight:700;">₹${parseFloat(full.paidAmount ?? "0").toFixed(2)}</td></tr>
<tr style="background:#f8fafc;"><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;">Payment Method</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">${full.paymentMethod}</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;">Payment Date</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">${fmtDate(full.paymentDate ?? new Date().toISOString().split("T")[0])}</td></tr>
</table>
</div>
<div style="padding:12px 28px;border-top:1px solid #e2e8f0;text-align:center;">
<p style="margin:0 0 4px;color:#374151;font-size:13px;font-weight:600;">${sName}</p>
${school.address ? `<p style="margin:0 0 2px;color:#64748b;font-size:11px;">${school.address}</p>` : ""}
${(school.phone || school.email) ? `<p style="margin:0 0 4px;color:#64748b;font-size:11px;">${[school.phone, school.email].filter(Boolean).join(" · ")}</p>` : ""}
<p style="margin:0;color:#94a3b8;font-size:11px;">Automated receipt — please keep this for your records.</p>
</div>
</div>
</body></html>`;
        await mailer.transport.sendMail({
          from: `"${sName}" <${mailer.from}>`,
          to: full.parentEmail!,
          subject: `Fee Receipt — ${full.studentName} — ${monthName(full.month)} ${full.year}`,
          html,
        });
        logger.info({ studentId: full.studentId }, "Fee receipt sent");
      }
    } catch (err: any) {
      logger.warn({ err: err.message }, "Failed to send receipt email");
    }
  }

  return res.status(201).json(toPaymentResponse(full));
});

// ─── Batch collect: insert all payment records in one DB transaction ──
router.post("/fees/payments/batch", async (req, res) => {
  const { payments } = req.body;
  if (!Array.isArray(payments) || payments.length === 0) {
    return res.status(400).json({ error: "payments array is required and must be non-empty" });
  }

  const values = payments.map((p: any) => ({
    studentId: parseInt(p.studentId, 10),
    categoryId: parseInt(p.categoryId, 10),
    amount: String(parseFloat(p.amount)),
    paidAmount: String(parseFloat(p.paidAmount)),
    discount: String(parseFloat(p.discount ?? 0)),
    fine: String(parseFloat(p.fine ?? 0)),
    status: p.status,
    month: parseInt(p.month, 10),
    year: parseInt(p.year, 10),
    session: String(p.session),
    paymentDate: p.paymentDate ?? null,
    paymentMethod: p.paymentMethod ?? "cash",
    receiptNo: p.receiptNo ?? "",
    remarks: p.remarks ?? "",
    isPreviousDue: !!p.isPreviousDue,
    previousSession: p.previousSession ?? "",
    collectedBy: p.collectedBy ?? "",
  }));

  const inserted = await db.transaction(async (tx) =>
    tx.insert(feePaymentsTable).values(values).returning()
  );

  if (inserted.length === 0) return res.json([]);
  const ids = inserted.map(r => r.id);

  const full = await db.select({
    id: feePaymentsTable.id,
    studentId: feePaymentsTable.studentId,
    studentName: studentsTable.studentName,
    rollNo: studentsTable.rollNo,
    fatherName: studentsTable.fatherName,
    parentEmail: studentsTable.parentEmail,
    whatsappNumber: studentsTable.whatsappNumber,
    classId: studentsTable.classId,
    className: classesTable.name,
    sectionId: studentsTable.sectionId,
    sectionName: sectionsTable.name,
    categoryId: feePaymentsTable.categoryId,
    categoryName: feeCategoriesTable.name,
    amount: feePaymentsTable.amount,
    paidAmount: feePaymentsTable.paidAmount,
    discount: feePaymentsTable.discount,
    fine: feePaymentsTable.fine,
    status: feePaymentsTable.status,
    month: feePaymentsTable.month,
    year: feePaymentsTable.year,
    session: feePaymentsTable.session,
    paymentDate: feePaymentsTable.paymentDate,
    paymentMethod: feePaymentsTable.paymentMethod,
    receiptNo: feePaymentsTable.receiptNo,
    remarks: feePaymentsTable.remarks,
    isPreviousDue: feePaymentsTable.isPreviousDue,
    previousSession: feePaymentsTable.previousSession,
    collectedBy: feePaymentsTable.collectedBy,
    createdAt: feePaymentsTable.createdAt,
  })
    .from(feePaymentsTable)
    .leftJoin(studentsTable, eq(feePaymentsTable.studentId, studentsTable.id))
    .leftJoin(classesTable, eq(studentsTable.classId, classesTable.id))
    .leftJoin(sectionsTable, eq(studentsTable.sectionId, sectionsTable.id))
    .leftJoin(feeCategoriesTable, eq(feePaymentsTable.categoryId, feeCategoriesTable.id))
    .where(inArray(feePaymentsTable.id, ids));

  // Sort to match insertion order — inArray gives no order guarantee from PostgreSQL
  const idIndex = new Map(ids.map((id, i) => [id, i]));
  const ordered = [...full].sort((a, b) => (idIndex.get(a.id) ?? 0) - (idIndex.get(b.id) ?? 0));

  return res.status(201).json(ordered.map(toPaymentResponse));
});

router.patch("/fees/payments/:id", async (req, res) => {
  const id = parseInt(req.params['id'] as string, 10);
  if (isNaN(id)) return res.status(400).json({ error: "invalid id" });
  const { paidAmount, discount, fine, status, paymentDate, paymentMethod, receiptNo, remarks } = req.body;
  const updates: any = {};
  if (paidAmount != null) updates.paidAmount = String(parseFloat(paidAmount));
  if (discount != null)   updates.discount   = String(parseFloat(discount));
  if (fine != null)       updates.fine       = String(parseFloat(fine));
  if (status)             updates.status     = status;
  if (paymentDate)        updates.paymentDate = paymentDate;
  if (paymentMethod)      updates.paymentMethod = paymentMethod;
  if (receiptNo != null)  updates.receiptNo  = receiptNo;
  if (remarks != null)    updates.remarks    = remarks;
  await db.update(feePaymentsTable).set(updates).where(eq(feePaymentsTable.id, id));

  // Fetch full row with student/class info
  const [full] = await db.select({
    id: feePaymentsTable.id,
    studentId: feePaymentsTable.studentId,
    studentName: studentsTable.studentName,
    rollNo: studentsTable.rollNo,
    fatherName: studentsTable.fatherName,
    parentEmail: studentsTable.parentEmail,
    whatsappNumber: studentsTable.whatsappNumber,
    classId: studentsTable.classId,
    className: classesTable.name,
    sectionId: studentsTable.sectionId,
    sectionName: sectionsTable.name,
    categoryId: feePaymentsTable.categoryId,
    categoryName: feeCategoriesTable.name,
    amount: feePaymentsTable.amount,
    paidAmount: feePaymentsTable.paidAmount,
    discount: feePaymentsTable.discount,
    fine: feePaymentsTable.fine,
    status: feePaymentsTable.status,
    month: feePaymentsTable.month,
    year: feePaymentsTable.year,
    session: feePaymentsTable.session,
    paymentDate: feePaymentsTable.paymentDate,
    paymentMethod: feePaymentsTable.paymentMethod,
    receiptNo: feePaymentsTable.receiptNo,
    remarks: feePaymentsTable.remarks,
    isPreviousDue: feePaymentsTable.isPreviousDue,
    previousSession: feePaymentsTable.previousSession,
    createdAt: feePaymentsTable.createdAt,
  })
    .from(feePaymentsTable)
    .leftJoin(studentsTable, eq(feePaymentsTable.studentId, studentsTable.id))
    .leftJoin(classesTable, eq(studentsTable.classId, classesTable.id))
    .leftJoin(sectionsTable, eq(studentsTable.sectionId, sectionsTable.id))
    .leftJoin(feeCategoriesTable, eq(feePaymentsTable.categoryId, feeCategoriesTable.id))
    .where(eq(feePaymentsTable.id, id));

  return res.json(toPaymentResponse(full));
});

router.delete("/fees/payments/:id", async (req, res) => {
  const id = parseInt(req.params['id'] as string, 10);
  if (isNaN(id)) return res.status(400).json({ error: "invalid id" });
  await db.delete(feePaymentsTable).where(eq(feePaymentsTable.id, id));
  return res.status(204).end();
});

// ─── Fee Summary ───────────────────────────────────────────────

router.get("/fees/summary", async (req, res) => {
  const { classId, month, year, session } = req.query;

  const rows = await db.select({
    studentId: feePaymentsTable.studentId,
    classId: studentsTable.classId,
    className: classesTable.name,
    amount: feePaymentsTable.amount,
    paidAmount: feePaymentsTable.paidAmount,
    status: feePaymentsTable.status,
    month: feePaymentsTable.month,
    year: feePaymentsTable.year,
    session: feePaymentsTable.session,
  })
    .from(feePaymentsTable)
    .leftJoin(studentsTable, eq(feePaymentsTable.studentId, studentsTable.id))
    .leftJoin(classesTable, eq(studentsTable.classId, classesTable.id));

  let filtered = rows;
  if (classId) { const cId = parseInt(classId as string, 10); if (!isNaN(cId)) filtered = filtered.filter(r => r.classId === cId); }
  if (month)   { const m   = parseInt(month as string, 10);   if (!isNaN(m))   filtered = filtered.filter(r => r.month === m); }
  if (year)    { const y   = parseInt(year as string, 10);    if (!isNaN(y))   filtered = filtered.filter(r => r.year === y); }
  if (session && typeof session === "string" && session.trim()) filtered = filtered.filter(r => r.session === session.trim());

  const totalDue     = filtered.reduce((s, r) => s + parseFloat(r.amount ?? "0"), 0);
  const totalPaid    = filtered.reduce((s, r) => s + parseFloat(r.paidAmount ?? "0"), 0);
  const totalPending = filtered.reduce((s, r) => {
    if (r.status === "paid") return s;
    return s + Math.max(0, parseFloat(r.amount ?? "0") - parseFloat(r.paidAmount ?? "0"));
  }, 0);
  const totalPartial = filtered.filter(r => r.status === "partial").reduce((s, r) => s + (parseFloat(r.amount ?? "0") - parseFloat(r.paidAmount ?? "0")), 0);
  const collectionRate = totalDue > 0 ? (totalPaid / totalDue) * 100 : 0;

  // Group by class
  const classMap = new Map<number, { classId: number; className: string; due: number; paid: number; pending: number }>();
  for (const r of filtered) {
    if (!r.classId) continue;
    if (!classMap.has(r.classId)) classMap.set(r.classId, { classId: r.classId, className: r.className ?? "", due: 0, paid: 0, pending: 0 });
    const entry = classMap.get(r.classId)!;
    entry.due += parseFloat(r.amount ?? "0");
    if (r.status === "paid") entry.paid += parseFloat(r.paidAmount ?? "0");
    else entry.pending += Math.max(0, parseFloat(r.amount ?? "0") - parseFloat(r.paidAmount ?? "0"));
  }

  // Group by month
  const monthMap = new Map<string, { month: number; year: number; due: number; paid: number; pending: number }>();
  for (const r of filtered) {
    const key = `${r.year}-${r.month}`;
    if (!monthMap.has(key)) monthMap.set(key, { month: r.month!, year: r.year!, due: 0, paid: 0, pending: 0 });
    const entry = monthMap.get(key)!;
    entry.due += parseFloat(r.amount ?? "0");
    if (r.status === "paid") entry.paid += parseFloat(r.paidAmount ?? "0");
    else entry.pending += Math.max(0, parseFloat(r.amount ?? "0") - parseFloat(r.paidAmount ?? "0"));
  }

  return res.json({
    totalDue, totalPaid, totalPending, totalPartial,
    collectionRate: Math.round(collectionRate * 100) / 100,
    byClass: Array.from(classMap.values()),
    byMonth: Array.from(monthMap.values()).sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month),
  });
});

// ─── Pending Students ──────────────────────────────────────────

router.get("/fees/pending-students", async (req, res) => {
  const { classId, sectionId, month, year, session } = req.query;

  const rows = await db.select({
    studentId: studentsTable.id,
    studentName: studentsTable.studentName,
    rollNo: studentsTable.rollNo,
    fatherName: studentsTable.fatherName,
    parentEmail: studentsTable.parentEmail,
    whatsappNumber: studentsTable.whatsappNumber,
    classId: studentsTable.classId,
    className: classesTable.name,
    sectionId: studentsTable.sectionId,
    sectionName: sectionsTable.name,
    paymentAmount: feePaymentsTable.amount,
    paidAmount: feePaymentsTable.paidAmount,
    status: feePaymentsTable.status,
    month: feePaymentsTable.month,
    year: feePaymentsTable.year,
    session: feePaymentsTable.session,
  })
    .from(feePaymentsTable)
    .leftJoin(studentsTable, eq(feePaymentsTable.studentId, studentsTable.id))
    .leftJoin(classesTable, eq(studentsTable.classId, classesTable.id))
    .leftJoin(sectionsTable, eq(studentsTable.sectionId, sectionsTable.id))
    .where(inArray(feePaymentsTable.status, ["pending", "partial"]));

  let filtered = rows;
  if (classId)   { const cId = parseInt(classId as string, 10);   if (!isNaN(cId)) filtered = filtered.filter(r => r.classId === cId); }
  if (sectionId) { const sid = parseInt(sectionId as string, 10); if (!isNaN(sid)) filtered = filtered.filter(r => r.sectionId === sid); }
  if (month)     { const m   = parseInt(month as string, 10);     if (!isNaN(m))   filtered = filtered.filter(r => r.month === m); }
  if (year)      { const y   = parseInt(year as string, 10);      if (!isNaN(y))   filtered = filtered.filter(r => r.year === y); }
  if (session && typeof session === "string" && session.trim()) filtered = filtered.filter(r => r.session === session.trim());

  // Aggregate per student
  const studentMap = new Map<number, any>();
  for (const r of filtered) {
    if (!r.studentId) continue;
    if (!studentMap.has(r.studentId)) {
      studentMap.set(r.studentId, {
        studentId: r.studentId, studentName: r.studentName, rollNo: r.rollNo,
        fatherName: r.fatherName, parentEmail: r.parentEmail, whatsappNumber: r.whatsappNumber,
        classId: r.classId, className: r.className, sectionId: r.sectionId, sectionName: r.sectionName,
        totalDue: 0, totalPaid: 0, balance: 0, pendingMonths: 0,
      });
    }
    const s = studentMap.get(r.studentId)!;
    s.totalDue  += parseFloat(r.paymentAmount ?? "0");
    s.totalPaid += parseFloat(r.paidAmount ?? "0");
    s.pendingMonths++;
  }

  const result = Array.from(studentMap.values()).map(s => ({
    ...s,
    balance: Math.max(0, s.totalDue - s.totalPaid),
  })).sort((a, b) => b.balance - a.balance);

  return res.json(result);
});

// ─── Transport Category Helper ──────────────────────────────────

router.get("/fees/transport-category", async (_req, res) => {
  let [cat] = await db.select({ id: feeCategoriesTable.id, name: feeCategoriesTable.name })
    .from(feeCategoriesTable)
    .where(ilike(feeCategoriesTable.name, "transport%"))
    .limit(1);
  if (!cat) {
    [cat] = await db.insert(feeCategoriesTable).values({
      name: "Transport Fee",
      description: "Bus/Transport monthly fee",
      frequency: "monthly",
    }).returning({ id: feeCategoriesTable.id, name: feeCategoriesTable.name });
  }
  return res.json(cat);
});

// ─── Fee Reminders ─────────────────────────────────────────────

router.post("/fees/remind", async (req, res) => {
  const { studentIds, month, year, session, customMessage, sendWhatsapp } = req.body;
  if (!studentIds?.length || !month || !year || !session) {
    return res.status(400).json({ error: "studentIds, month, year, session are required" });
  }

  const mailer = await getMailer();
  if (!mailer) {
    return res.status(400).json({ error: "Gmail not configured. Please configure Gmail in the Security tab." });
  }

  // Get students with pending fees
  const students = await db.select({
    id: studentsTable.id,
    studentName: studentsTable.studentName,
    fatherName: studentsTable.fatherName,
    parentEmail: studentsTable.parentEmail,
    whatsappNumber: studentsTable.whatsappNumber,
  }).from(studentsTable).where(inArray(studentsTable.id, studentIds));

  const defaultMsg = customMessage?.trim()
    || `Dear Parent, this is a reminder that the school fee for ${monthName(month)} ${year} is pending. Please pay at the earliest to avoid late fine.`;

  const school = await getSchoolInfo().catch(() => ({ name: "", address: "", phone: "", email: "" }));
  const sName = school.name || "School";

  const results: any[] = [];
  for (const s of students) {
    if (!s.parentEmail) {
      results.push({ studentName: s.studentName, ok: false, error: "No email address" });
      continue;
    }
    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
<div style="max-width:560px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
<div style="background:#b45309;padding:20px 28px;text-align:center;">
<h1 style="margin:0;color:#fff;font-size:18px;font-weight:bold;">${sName}</h1>
<p style="margin:4px 0 0;color:#fde68a;font-size:13px;">Fee Payment Reminder</p>
</div>
<div style="padding:24px 28px;">
<p style="margin:0 0 12px;color:#334155;font-size:15px;">Dear Parent of <strong>${s.studentName}</strong>${s.fatherName ? ` (S/o ${s.fatherName})` : ""},</p>
<div style="margin:0 0 16px;color:#1e293b;font-size:15px;line-height:1.7;">${defaultMsg}</div>
<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:12px 16px;color:#92400e;font-size:14px;">
<strong>Month:</strong> ${monthName(month)} ${year} &nbsp;|&nbsp; <strong>Session:</strong> ${session}
</div>
</div>
<div style="padding:12px 28px;border-top:1px solid #e2e8f0;text-align:center;">
<p style="margin:0 0 4px;color:#374151;font-size:13px;font-weight:600;">${sName}</p>
${school.address ? `<p style="margin:0 0 2px;color:#64748b;font-size:11px;">${school.address}</p>` : ""}
${(school.phone || school.email) ? `<p style="margin:0 0 4px;color:#64748b;font-size:11px;">${[school.phone, school.email].filter(Boolean).join(" · ")}</p>` : ""}
<p style="margin:0;color:#94a3b8;font-size:11px;">Automated reminder — please do not reply to this email.</p>
</div>
</div>
</body></html>`;
    try {
      await mailer.transport.sendMail({
        from: `"${sName}" <${mailer.from}>`,
        to: s.parentEmail,
        subject: `Fee Reminder — ${s.studentName} — ${monthName(month)} ${year}`,
        html,
      });
      results.push({ email: s.parentEmail, studentName: s.studentName, ok: true });
    } catch (err: any) {
      results.push({ email: s.parentEmail, studentName: s.studentName, ok: false, error: err.message });
    }
  }

  const sent = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  return res.json({ ok: true, sent, failed, results });
});

// ─── Send Receipt ──────────────────────────────────────────────

router.post("/fees/receipt/:paymentId", async (req, res) => {
  const paymentId = parseInt(req.params['paymentId'] as string, 10);
  if (isNaN(paymentId)) return res.status(400).json({ error: "invalid paymentId" });

  const [full] = await db.select({
    id: feePaymentsTable.id,
    studentName: studentsTable.studentName,
    rollNo: studentsTable.rollNo,
    fatherName: studentsTable.fatherName,
    parentEmail: studentsTable.parentEmail,
    className: classesTable.name,
    sectionName: sectionsTable.name,
    categoryName: feeCategoriesTable.name,
    amount: feePaymentsTable.amount,
    paidAmount: feePaymentsTable.paidAmount,
    status: feePaymentsTable.status,
    month: feePaymentsTable.month,
    year: feePaymentsTable.year,
    paymentDate: feePaymentsTable.paymentDate,
    paymentMethod: feePaymentsTable.paymentMethod,
    receiptNo: feePaymentsTable.receiptNo,
  })
    .from(feePaymentsTable)
    .leftJoin(studentsTable, eq(feePaymentsTable.studentId, studentsTable.id))
    .leftJoin(classesTable, eq(studentsTable.classId, classesTable.id))
    .leftJoin(sectionsTable, eq(studentsTable.sectionId, sectionsTable.id))
    .leftJoin(feeCategoriesTable, eq(feePaymentsTable.categoryId, feeCategoriesTable.id))
    .where(eq(feePaymentsTable.id, paymentId));

  if (!full) return res.status(404).json({ error: "Payment not found" });
  if (!full.parentEmail) return res.status(400).json({ error: "No parent email for this student" });

  const mailer = await getMailer();
  if (!mailer) return res.status(400).json({ error: "Gmail not configured" });

  const school = await getSchoolInfo().catch(() => ({ name: "", address: "", phone: "", email: "" }));
  const sName = school.name || "School";

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
<div style="max-width:560px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
<div style="background:#0f766e;padding:20px 28px;text-align:center;">
<h1 style="margin:0;color:#fff;font-size:18px;font-weight:bold;">${sName}</h1>
<p style="margin:4px 0 0;color:#99f6e4;font-size:13px;">Fee Receipt</p>
</div>
<div style="padding:24px 28px;">
<p style="margin:0 0 16px;color:#334155;font-size:15px;">Dear Parent of <strong>${full.studentName}</strong>,</p>
<table style="width:100%;border-collapse:collapse;font-size:14px;color:#1e293b;">
<tr style="background:#f8fafc;"><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;">Receipt No.</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">${full.receiptNo || `RCP-${full.id}`}</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;">Student</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">${full.studentName} (Roll: ${full.rollNo})</td></tr>
<tr style="background:#f8fafc;"><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;">Class</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">${full.className} – ${full.sectionName}</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;">Fee Type</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">${full.categoryName}</td></tr>
<tr style="background:#f8fafc;"><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;">Month</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">${monthName(full.month!)} ${full.year}</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;">Amount Paid</td><td style="padding:8px 12px;border:1px solid #e2e8f0;color:#0f766e;font-weight:700;">₹${parseFloat(full.paidAmount ?? "0").toFixed(2)}</td></tr>
<tr style="background:#f8fafc;"><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;">Payment Method</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">${full.paymentMethod}</td></tr>
<tr><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;">Payment Date</td><td style="padding:8px 12px;border:1px solid #e2e8f0;">${fmtDate(full.paymentDate ?? new Date().toISOString().split("T")[0])}</td></tr>
</table>
</div>
<div style="padding:12px 28px;border-top:1px solid #e2e8f0;text-align:center;">
<p style="margin:0 0 4px;color:#374151;font-size:13px;font-weight:600;">${sName}</p>
${school.address ? `<p style="margin:0 0 2px;color:#64748b;font-size:11px;">${school.address}</p>` : ""}
${(school.phone || school.email) ? `<p style="margin:0 0 4px;color:#64748b;font-size:11px;">${[school.phone, school.email].filter(Boolean).join(" · ")}</p>` : ""}
<p style="margin:0;color:#94a3b8;font-size:11px;">Automated receipt — please keep this for your records.</p>
</div>
</div>
</body></html>`;

  try {
    await mailer.transport.sendMail({
      from: `"${sName}" <${mailer.from}>`,
      to: full.parentEmail,
      subject: `Fee Receipt — ${full.studentName} — ${monthName(full.month!)} ${full.year}`,
      html,
    });
    return res.json({ ok: true, message: `Receipt sent to ${full.parentEmail}` });
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

// ─── Send Receipt HTML Email ────────────────────────────────────

router.post("/fees/send-receipt-html-email", async (req, res) => {
  const {
    toEmail, receiptNo, studentName, fatherName, uniqueId, className, sectionName,
    monthsLabel, payDate, payMode, totalPaid, totalDue, totalBalance,
    schoolName, schoolAddress, schoolPhone, receiptFooter, feeRowsHtml,
  } = req.body as {
    toEmail?: string; receiptNo?: string; studentName?: string; fatherName?: string;
    uniqueId?: string; className?: string; sectionName?: string; monthsLabel?: string;
    payDate?: string; payMode?: string; totalPaid?: number; totalDue?: number; totalBalance?: number;
    schoolName?: string; schoolAddress?: string; schoolPhone?: string; receiptFooter?: string;
    feeRowsHtml?: string;
  };

  if (!toEmail?.trim()) return res.status(400).json({ error: "toEmail is required" });

  const mailer = await getMailer();
  if (!mailer) return res.status(400).json({ error: "Gmail not configured" });

  const sName = studentName || "Student";
  const school = schoolName || "School Management System";
  const rNo = receiptNo || "—";
  const paid = typeof totalPaid === "number" ? `₹${totalPaid.toFixed(2)}` : "—";
  const balance = typeof totalBalance === "number" && totalBalance > 0.01 ? totalBalance : 0;

  const td1 = `style="padding:6px 10px;border:1px solid #ccc;font-weight:bold;color:#444;font-size:13px;width:38%;background:#f8fafc"`;
  const td2 = `style="padding:6px 10px;border:1px solid #ccc;font-size:13px"`;

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
<div style="max-width:600px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.10);">

  <!-- Header -->
  <div style="background:#0d3064;padding:20px 28px;text-align:center;">
    <h1 style="margin:0;color:#fff;font-size:18px;font-weight:800;">${school}</h1>
    ${schoolAddress ? `<p style="margin:3px 0 0;color:#93c5fd;font-size:12px">${schoolAddress}</p>` : ""}
    ${schoolPhone ? `<p style="margin:2px 0 0;color:#93c5fd;font-size:12px">Ph: ${schoolPhone}</p>` : ""}
    <p style="margin:6px 0 0;color:#bfdbfe;font-size:13px;letter-spacing:1px;font-weight:bold">FEE RECEIPT</p>
  </div>

  <!-- Greeting -->
  <div style="padding:20px 28px 0;">
    <p style="margin:0 0 14px;color:#334155;font-size:14px">Dear Parent of <strong>${sName}</strong>,</p>
    <p style="margin:0 0 16px;color:#64748b;font-size:13px">Please find below the fee receipt for <strong>${monthsLabel || rNo}</strong>. Keep this for your records.</p>
  </div>

  <!-- Student details -->
  <div style="padding:0 28px;">
    <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
      <tr><td ${td1}>Receipt No.</td><td ${td2} style="padding:6px 10px;border:1px solid #ccc;font-size:12px;color:#64748b">${rNo}</td></tr>
      <tr><td ${td1}>Student</td><td ${td2}>${sName}</td></tr>
      ${fatherName ? `<tr><td ${td1}>Father</td><td ${td2}>${fatherName}</td></tr>` : ""}
      ${uniqueId ? `<tr><td ${td1}>Adm. No.</td><td ${td2}>${uniqueId}</td></tr>` : ""}
      <tr><td ${td1}>Class</td><td ${td2}>${className || ""}${sectionName ? ` — ${sectionName}` : ""}</td></tr>
      <tr><td ${td1}>Month(s)</td><td ${td2}>${monthsLabel || "—"}</td></tr>
      <tr><td ${td1}>Date</td><td ${td2}>${fmtDate(payDate) || "—"}</td></tr>
      <tr><td ${td1}>Mode</td><td ${td2}>${payMode || "—"}</td></tr>
    </table>

    <!-- Fee breakdown -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
      ${feeRowsHtml || ""}
    </table>

    <!-- Totals -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:18px;">
      ${totalDue && totalDue !== totalPaid ? `<tr style="background:#eff6ff"><td style="padding:6px 10px;border:1px solid #ccc;font-size:13px;color:#1e40af;font-weight:bold">Total Fee Due</td><td style="padding:6px 10px;border:1px solid #ccc;font-size:13px;text-align:right;color:#1e40af;font-weight:bold">₹${(totalDue as number).toFixed(2)}</td></tr>` : ""}
      <tr style="background:#f0f9f0"><td style="padding:8px 10px;border:1px solid #ccc;font-size:14px;font-weight:bold">Total Paid</td><td style="padding:8px 10px;border:1px solid #ccc;font-size:14px;font-weight:bold;text-align:right;color:#15803d">${paid}</td></tr>
      ${balance > 0.01
        ? `<tr style="background:#fff7f7"><td style="padding:6px 10px;border:1px solid #ccc;font-size:13px;color:#dc2626;font-weight:bold">Balance Remaining</td><td style="padding:6px 10px;border:1px solid #ccc;font-size:13px;text-align:right;color:#dc2626;font-weight:bold">₹${balance.toFixed(2)}</td></tr>`
        : `<tr><td colspan="2" style="padding:6px 10px;border:1px solid #ccc;text-align:center;color:#16a34a;font-weight:bold;font-size:13px">✓ Fully Paid</td></tr>`}
    </table>
  </div>

  <!-- Footer -->
  <div style="padding:12px 28px;border-top:1px solid #e2e8f0;text-align:center;background:#f8fafc">
    <p style="margin:0;color:#94a3b8;font-size:11px">${receiptFooter || `${school} — computer-generated receipt.`}</p>
  </div>
</div>
</body></html>`;

  try {
    await mailer.transport.sendMail({
      from: `"${school}" <${mailer.from}>`,
      to: toEmail.trim(),
      subject: `Fee Receipt — ${sName} — ${monthsLabel || rNo}`,
      html,
    });
    logger.info({ toEmail, receiptNo }, "Receipt HTML email sent");
    return res.json({ ok: true });
  } catch (err: any) {
    logger.warn({ err: err.message }, "Receipt HTML email failed");
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Receipt Verification (public) ─────────────────────────────

router.get("/fees/receipt-verify/:receiptNo", async (req, res) => {
  const { receiptNo } = req.params;
  if (!receiptNo?.trim()) return res.status(400).json({ found: false });

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function mLabel(m: number) { return MONTHS[(m - 1) % 12] || String(m); }

  const rows = await db
    .select({
      paymentId: feePaymentsTable.id,
      studentId: feePaymentsTable.studentId,
      studentName: studentsTable.studentName,
      className: classesTable.name,
      sectionName: sectionsTable.name,
      month: feePaymentsTable.month,
      year: feePaymentsTable.year,
      paidAmount: feePaymentsTable.paidAmount,
      paymentDate: feePaymentsTable.paymentDate,
      paymentMethod: feePaymentsTable.paymentMethod,
      receiptNo: feePaymentsTable.receiptNo,
    })
    .from(feePaymentsTable)
    .innerJoin(studentsTable, eq(feePaymentsTable.studentId, studentsTable.id))
    .leftJoin(classesTable, eq(studentsTable.classId, classesTable.id))
    .leftJoin(sectionsTable, eq(studentsTable.sectionId, sectionsTable.id))
    .where(eq(feePaymentsTable.receiptNo, receiptNo.trim()))
    .orderBy(feePaymentsTable.month);

  if (rows.length === 0) return res.json({ found: false });

  const first = rows[0];
  const totalPaid = rows.reduce((s, r) => s + (parseFloat(String(r.paidAmount)) || 0), 0);
  const months = [...new Set(rows.map(r => r.month != null ? `${mLabel(r.month)} ${r.year}` : "").filter(Boolean))];

  return res.json({
    found: true,
    receiptNo: first.receiptNo,
    studentName: first.studentName,
    className: first.className ?? "",
    sectionName: first.sectionName ?? "",
    months,
    totalPaid: parseFloat(totalPaid.toFixed(2)),
    paymentDate: first.paymentDate ? String(first.paymentDate) : null,
    paymentMethod: first.paymentMethod ?? "",
  });
});

export default router;
