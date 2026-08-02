import { Router } from "express";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import { db, globalDb, pool, parentsTable, studentParentTable, studentsTable, appSettingsTable, transportRoutesTable, academicSessionsTable } from "@workspace/db";
import { eq, sql as rawSql } from "drizzle-orm";

async function getParentMustChangePassword(parentId: number): Promise<boolean> {
  try {
    const result = await globalDb.execute(rawSql`SELECT must_change_password FROM parents WHERE id = ${parentId}`);
    return (result.rows[0] as any)?.must_change_password ?? true;
  } catch {
    return false;
  }
}

async function clearParentMustChangePassword(parentId: number): Promise<void> {
  try {
    await globalDb.execute(rawSql`UPDATE parents SET must_change_password = false WHERE id = ${parentId}`);
  } catch {
    // column may not exist in production yet — ignore
  }
}
import { signToken } from "../lib/jwt";
import { requireAuth } from "../lib/auth-middleware";
import { logger } from "../lib/logger";
import { generateOtp, setOtp, verifyOtp } from "../lib/otp-store";
import { getCurrentSchemaName, getCurrentSessionName } from "../lib/session-context";

const router = Router();

// ── Cross-schema student lookup ───────────────────────────────────────────────
// Students live in session-specific schemas (e.g. y2026_2027.students).
// This finds each student across ALL academic schemas, returning the schema
// they belong to. Most-recent session is checked first.
interface LinkedStudent {
  studentId: number;
  studentName: string | null;
  classId: number | null;
  sessionSchema: string;
  sessionName: string;
}

async function findStudentsAcrossSchemas(studentIds: number[]): Promise<LinkedStudent[]> {
  if (studentIds.length === 0) return [];

  const sessions = await globalDb
    .select({ schemaName: academicSessionsTable.schemaName, name: academicSessionsTable.name, yearStart: academicSessionsTable.yearStart })
    .from(academicSessionsTable)
    .orderBy(academicSessionsTable.yearStart);

  // Check most-recent sessions first
  const ordered = [...sessions].reverse();
  const found = new Map<number, LinkedStudent>();

  for (const session of ordered) {
    const remaining = studentIds.filter(id => !found.has(id));
    if (remaining.length === 0) break;
    const client = await pool.connect();
    try {
      const { rows } = await client.query<{ id: number; student_name: string; class_id: number }>(
        `SELECT id, student_name, class_id FROM "${session.schemaName}"."students" WHERE id = ANY($1)`,
        [remaining],
      );
      for (const row of rows) {
        found.set(row.id, {
          studentId: row.id,
          studentName: row.student_name,
          classId: row.class_id,
          sessionSchema: session.schemaName,
          sessionName: session.name,
        });
      }
    } catch {
      // Schema / table may not exist yet — skip
    } finally {
      client.release();
    }
  }

  // Preserve input order; include even unfound IDs with nulls
  return studentIds.map(id => found.get(id) ?? { studentId: id, studentName: null, classId: null, sessionSchema: "", sessionName: "" });
}

async function getGmailCreds(): Promise<{ user: string; pass: string } | null> {
  const user = process.env.GMAIL_USER ||
    (await db.select({ value: appSettingsTable.value }).from(appSettingsTable).where(eq(appSettingsTable.key, "gmail_user")))[0]?.value || "";
  const pass = (process.env.GMAIL_APP_PASSWORD ||
    (await db.select({ value: appSettingsTable.value }).from(appSettingsTable).where(eq(appSettingsTable.key, "gmail_app_password")))[0]?.value || "").replace(/\s/g, "");
  if (!user || !pass) return null;
  return { user, pass };
}

// POST /auth/parent/login
router.post("/auth/parent/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

  // Look up parent in the global (public) schema
  const rows = await globalDb.select().from(parentsTable).where(eq(parentsTable.email, email.toLowerCase().trim()));
  const parent = rows[0];
  if (!parent) return res.status(401).json({ error: "Invalid credentials" });
  const valid = await bcrypt.compare(password, parent.passwordHash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  // Get the active academic session
  const currentSchema = getCurrentSchemaName();
  const currentSession = getCurrentSessionName();
  if (!currentSchema) {
    return res.status(503).json({ error: "No active academic session. Please contact the school." });
  }

  // Find this parent's linked student IDs from the global student_parent table
  const linkRows = await globalDb
    .select({ studentId: studentParentTable.studentId })
    .from(studentParentTable)
    .where(eq(studentParentTable.parentId, parent.id));
  const studentIds = linkRows.map(r => r.studentId);

  // Check whether any of those students are enrolled in the CURRENT session schema
  let currentStudents: Array<{ id: number; student_name: string; class_id: number }> = [];
  if (studentIds.length > 0) {
    const client = await pool.connect();
    try {
      const { rows: sRows } = await client.query<{ id: number; student_name: string; class_id: number }>(
        `SELECT id, student_name, class_id FROM "${currentSchema}"."students" WHERE id = ANY($1)`,
        [studentIds],
      );
      currentStudents = sRows;
    } catch {
      // Schema / table may not exist yet — treat as no enrolment
    } finally {
      client.release();
    }
  }

  // If no children are enrolled in the current session, deny login with a clear message
  if (currentStudents.length === 0) {
    logger.info({ parentId: parent.id, currentSession }, "Parent login denied — no children in current session");
    return res.status(403).json({
      error: "SESSION_ENDED",
      message:
        "Your session has ended and your children are not enrolled in the current academic session. " +
        "Please contact the school for more information.",
    });
  }

  // Build the student list for the response (current session only)
  const linkedRows = currentStudents.map(s => ({
    studentId: s.id,
    studentName: s.student_name,
    classId: s.class_id,
    sessionSchema: currentSchema,
    sessionName: currentSession ?? "",
  }));

  const name = parent.fatherName || parent.motherName || "Parent";
  const token = signToken({ id: parent.id, role: "parent", name, email: parent.email });
  logger.info({ parentId: parent.id }, "Parent logged in");
  return res.json({
    token,
    parent: {
      id: parent.id,
      fatherName: parent.fatherName,
      motherName: parent.motherName,
      email: parent.email,
      mobile: parent.mobile,
      mustChangePassword: parent.mustChangePassword,
      students: linkedRows,
    },
  });
});

// POST /auth/parent/forgot-password — send OTP to parent's registered email
router.post("/auth/parent/forgot-password", async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email?.trim()) return res.status(400).json({ error: "Email is required" });

  const rows = await db.select({ id: parentsTable.id, fatherName: parentsTable.fatherName, motherName: parentsTable.motherName, email: parentsTable.email })
    .from(parentsTable).where(eq(parentsTable.email, email.toLowerCase().trim()));
  if (!rows[0]) {
    return res.json({ ok: true, message: "If this email is registered, an OTP has been sent." });
  }

  const creds = await getGmailCreds();
  if (!creds) return res.status(503).json({ error: "Email service not configured. Please contact the school admin." });

  const otp = generateOtp();
  setOtp(`parent:${email.toLowerCase().trim()}`, otp);

  const name = rows[0].fatherName || rows[0].motherName || "Parent";
  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com", port: 587, secure: false,
    auth: { user: creds.user, pass: creds.pass },
    tls: { rejectUnauthorized: false },
  });

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:480px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#3b82f6;padding:20px 28px;text-align:center;">
      <div style="font-size:28px;margin-bottom:4px;">👨‍👩‍👧</div>
      <h1 style="margin:0;color:#fff;font-size:17px;font-weight:bold;">Parent Portal — Password Reset</h1>
    </div>
    <div style="padding:28px;">
      <p style="margin:0 0 8px;color:#374151;font-size:15px;">Hello <strong>${name}</strong>,</p>
      <p style="margin:0 0 20px;color:#64748b;font-size:14px;">Use the OTP below to reset your password. It expires in <strong>10 minutes</strong>.</p>
      <div style="background:#eff6ff;border:2px dashed #3b82f6;border-radius:10px;padding:20px;text-align:center;margin:0 0 20px;">
        <div style="font-size:38px;font-weight:bold;letter-spacing:10px;color:#1d4ed8;">${otp}</div>
        <div style="font-size:12px;color:#1d4ed8;margin-top:6px;">One-Time Password</div>
      </div>
      <p style="margin:0;color:#94a3b8;font-size:12px;">If you did not request this, ignore this email. Your password will remain unchanged.</p>
    </div>
  </div>
</body></html>`;

  try {
    await transport.sendMail({
      from: `"School Portal" <${creds.user}>`,
      to: rows[0].email,
      subject: "Your OTP for Parent Portal Password Reset",
      html,
    });
    logger.info({ parentId: rows[0].id }, "OTP sent for parent password reset");
  } catch (err: any) {
    logger.error({ err: err.message }, "Failed to send parent OTP email");
    return res.status(502).json({ error: "Failed to send email. Please try again or contact admin." });
  }

  return res.json({ ok: true, message: "OTP sent to your registered email." });
});

// POST /auth/parent/reset-password — verify OTP and set new password
router.post("/auth/parent/reset-password", async (req, res) => {
  const { email, otp, newPassword } = req.body as { email?: string; otp?: string; newPassword?: string };
  if (!email?.trim() || !otp?.trim() || !newPassword?.trim()) {
    return res.status(400).json({ error: "Email, OTP, and new password are required" });
  }
  if (newPassword.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

  if (!verifyOtp(`parent:${email.toLowerCase().trim()}`, otp.trim())) {
    return res.status(400).json({ error: "Invalid or expired OTP. Please request a new one." });
  }

  const rows = await db.select({ id: parentsTable.id }).from(parentsTable)
    .where(eq(parentsTable.email, email.toLowerCase().trim()));
  if (!rows[0]) return res.status(404).json({ error: "Account not found" });

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.update(parentsTable).set({ passwordHash }).where(eq(parentsTable.id, rows[0].id));

  logger.info({ parentId: rows[0].id }, "Parent password reset via OTP");
  return res.json({ ok: true, message: "Password reset successfully. You can now sign in." });
});

// GET /auth/parent/me
router.get("/auth/parent/me", requireAuth("parent"), async (req, res) => {
  // Use globalDb for the parent lookup (parents table is in public schema)
  const rows = await globalDb.select().from(parentsTable).where(eq(parentsTable.id, req.user!.id));
  const parent = rows[0];
  if (!parent) return res.status(404).json({ error: "Not found" });

  // Get student IDs from public schema student_parent table
  const linkRows = await globalDb
    .select({ studentId: studentParentTable.studentId })
    .from(studentParentTable)
    .where(eq(studentParentTable.parentId, parent.id));
  const studentIds = linkRows.map(r => r.studentId);

  // Only return students enrolled in the CURRENT academic session — exactly the
  // same check the login route performs. This prevents ghost students from old
  // sessions appearing in the dropdown when a new session has been created.
  const currentSchema = getCurrentSchemaName();
  const currentSession = getCurrentSessionName();

  let currentStudents: Array<{ id: number; student_name: string; class_id: number }> = [];
  if (studentIds.length > 0 && currentSchema) {
    const client = await pool.connect();
    try {
      const { rows: sRows } = await client.query<{ id: number; student_name: string; class_id: number }>(
        `SELECT id, student_name, class_id FROM "${currentSchema}"."students" WHERE id = ANY($1)`,
        [studentIds],
      );
      currentStudents = sRows;
    } catch {
      // Schema / table may not exist yet — treat as no enrolment
    } finally {
      client.release();
    }
  }

  if (currentStudents.length === 0) {
    // No children in the current session — return empty student list
    return res.json({ id: parent.id, fatherName: parent.fatherName, motherName: parent.motherName, email: parent.email, mobile: parent.mobile, students: [] });
  }

  // Load extra fields (previousYearDue, transport, etc.) for current-session
  // students only. Use innerJoin so only students that exist in the current
  // session schema are included — leftJoin would leak rows for old-session IDs.
  const currentStudentIds = currentStudents.map(s => s.id);
  const extraRows = await db
    .select({
      studentId: studentParentTable.studentId,
      previousYearDue: studentsTable.previousYearDue,
      previousYearDueRemarks: studentsTable.previousYearDueRemarks,
      hasVehicle: studentsTable.hasVehicle,
      transportRouteId: studentsTable.transportRouteId,
      transportFromMonth: studentsTable.transportFromMonth,
      transportStopMonth: studentsTable.transportStopMonth,
      transportRoutePricePerMonth: transportRoutesTable.pricePerMonth,
      studentType: studentsTable.studentType,
      admissionDate: studentsTable.admissionDate,
    })
    .from(studentParentTable)
    .innerJoin(studentsTable, eq(studentParentTable.studentId, studentsTable.id))
    .leftJoin(transportRoutesTable, eq(studentsTable.transportRouteId, transportRoutesTable.id))
    .where(eq(studentParentTable.parentId, parent.id));

  const extraMap = new Map(extraRows.map(r => [r.studentId, r]));

  const students = currentStudents.map(s => {
    const extra = extraMap.get(s.id);
    return {
      studentId: s.id,
      studentName: s.student_name,
      classId: s.class_id,
      sessionSchema: currentSchema,
      sessionName: currentSession ?? "",
      previousYearDue: extra?.previousYearDue ?? null,
      previousYearDueRemarks: extra?.previousYearDueRemarks ?? null,
      hasVehicle: extra?.hasVehicle ?? null,
      transportRouteId: extra?.transportRouteId ?? null,
      transportFromMonth: extra?.transportFromMonth ?? null,
      transportStopMonth: extra?.transportStopMonth ?? null,
      transportRoutePricePerMonth: extra?.transportRoutePricePerMonth != null
        ? parseFloat(extra.transportRoutePricePerMonth as string) : null,
      studentType: extra?.studentType ?? null,
      admissionDate: extra?.admissionDate ?? null,
    };
  });

  return res.json({ id: parent.id, fatherName: parent.fatherName, motherName: parent.motherName, email: parent.email, mobile: parent.mobile, mustChangePassword: parent.mustChangePassword, students });
});

// POST /auth/parent/set-first-password — authenticated, first-time password set (no old password needed)
// Only works when mustChangePassword is true on the account.
router.post("/auth/parent/set-first-password", requireAuth("parent"), async (req, res) => {
  const { newPassword } = req.body as { newPassword?: string };
  if (!newPassword?.trim()) return res.status(400).json({ error: "New password is required" });
  if (newPassword.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

  const mustChange = await getParentMustChangePassword(req.user!.id);
  if (!mustChange) return res.status(403).json({ error: "Password has already been set. Use the change-password page." });

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await globalDb.update(parentsTable).set({ passwordHash, mustChangePassword: false }).where(eq(parentsTable.id, req.user!.id));

  logger.info({ parentId: req.user!.id }, "Parent set first-time password");
  return res.json({ ok: true, message: "Password set successfully." });
});

// POST /auth/parent/change-password — authenticated, change using old password
router.post("/auth/parent/change-password", requireAuth("parent"), async (req, res) => {
  const { oldPassword, newPassword } = req.body as { oldPassword?: string; newPassword?: string };
  if (!oldPassword?.trim() || !newPassword?.trim()) {
    return res.status(400).json({ error: "Old password and new password are required" });
  }
  if (newPassword.length < 6) return res.status(400).json({ error: "New password must be at least 6 characters" });

  const rows = await globalDb.select().from(parentsTable).where(eq(parentsTable.id, req.user!.id));
  const parent = rows[0];
  if (!parent) return res.status(404).json({ error: "Account not found" });

  const valid = await bcrypt.compare(oldPassword, parent.passwordHash);
  if (!valid) return res.status(400).json({ error: "Current password is incorrect" });

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await globalDb.update(parentsTable).set({ passwordHash, mustChangePassword: false }).where(eq(parentsTable.id, parent.id));

  logger.info({ parentId: parent.id }, "Parent changed password via old password");
  return res.json({ ok: true, message: "Password changed successfully." });
});

// POST /auth/parent/send-change-otp — authenticated, send OTP to parent's own email
router.post("/auth/parent/send-change-otp", requireAuth("parent"), async (req, res) => {
  const rows = await globalDb.select({ id: parentsTable.id, fatherName: parentsTable.fatherName, motherName: parentsTable.motherName, email: parentsTable.email })
    .from(parentsTable).where(eq(parentsTable.id, req.user!.id));
  const parent = rows[0];
  if (!parent) return res.status(404).json({ error: "Account not found" });

  const creds = await getGmailCreds();
  if (!creds) return res.status(503).json({ error: "Email service not configured. Please contact the school admin." });

  const otp = generateOtp();
  setOtp(`parent-change:${parent.email}`, otp);

  const name = parent.fatherName || parent.motherName || "Parent";
  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com", port: 587, secure: false,
    auth: { user: creds.user, pass: creds.pass },
    tls: { rejectUnauthorized: false },
  });

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:480px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#3b82f6;padding:20px 28px;text-align:center;">
      <div style="font-size:28px;margin-bottom:4px;">👨‍👩‍👧</div>
      <h1 style="margin:0;color:#fff;font-size:17px;font-weight:bold;">Parent Portal — Change Password</h1>
    </div>
    <div style="padding:28px;">
      <p style="margin:0 0 8px;color:#374151;font-size:15px;">Hello <strong>${name}</strong>,</p>
      <p style="margin:0 0 20px;color:#64748b;font-size:14px;">Use the OTP below to change your password. It expires in <strong>10 minutes</strong>.</p>
      <div style="background:#eff6ff;border:2px dashed #3b82f6;border-radius:10px;padding:20px;text-align:center;margin:0 0 20px;">
        <div style="font-size:38px;font-weight:bold;letter-spacing:10px;color:#1d4ed8;">${otp}</div>
        <div style="font-size:12px;color:#1d4ed8;margin-top:6px;">One-Time Password</div>
      </div>
      <p style="margin:0;color:#94a3b8;font-size:12px;">If you did not request this, someone else may have access to your account. Please contact the school admin.</p>
    </div>
  </div>
</body></html>`;

  try {
    await transport.sendMail({
      from: `"School Portal" <${creds.user}>`,
      to: parent.email,
      subject: "Your OTP for Parent Portal Password Change",
      html,
    });
    logger.info({ parentId: parent.id }, "OTP sent for parent password change");
  } catch (err: any) {
    logger.error({ err: err.message }, "Failed to send parent change-password OTP email");
    return res.status(502).json({ error: "Failed to send email. Please try again or contact admin." });
  }

  return res.json({ ok: true, message: "OTP sent to your registered email." });
});

// POST /auth/parent/change-password-otp — authenticated, verify OTP and set new password
router.post("/auth/parent/change-password-otp", requireAuth("parent"), async (req, res) => {
  const { otp, newPassword } = req.body as { otp?: string; newPassword?: string };
  if (!otp?.trim() || !newPassword?.trim()) {
    return res.status(400).json({ error: "OTP and new password are required" });
  }
  if (newPassword.length < 6) return res.status(400).json({ error: "New password must be at least 6 characters" });

  const rows = await globalDb.select({ id: parentsTable.id, email: parentsTable.email })
    .from(parentsTable).where(eq(parentsTable.id, req.user!.id));
  const parent = rows[0];
  if (!parent) return res.status(404).json({ error: "Account not found" });

  if (!verifyOtp(`parent-change:${parent.email}`, otp.trim())) {
    return res.status(400).json({ error: "Invalid or expired OTP. Please request a new one." });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await globalDb.update(parentsTable).set({ passwordHash, mustChangePassword: false }).where(eq(parentsTable.id, parent.id));

  logger.info({ parentId: parent.id }, "Parent changed password via OTP");
  return res.json({ ok: true, message: "Password changed successfully." });
});

export default router;
