import { Router } from "express";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import { db, teachersTable, appSettingsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

async function getMustChangePassword(teacherId: number): Promise<boolean> {
  try {
    const result = await db.execute(sql`SELECT must_change_password FROM teachers WHERE id = ${teacherId}`);
    return (result.rows[0] as any)?.must_change_password ?? true;
  } catch {
    return false;
  }
}

async function clearMustChangePassword(teacherId: number): Promise<void> {
  try {
    await db.execute(sql`UPDATE teachers SET must_change_password = false WHERE id = ${teacherId}`);
  } catch {
    // column may not exist in production yet — ignore
  }
}
import { signToken } from "../lib/jwt";
import { requireAuth } from "../lib/auth-middleware";
import { logger } from "../lib/logger";
import { generateOtp, setOtp, verifyOtp } from "../lib/otp-store";

const router = Router();

async function getGmailCreds(): Promise<{ user: string; pass: string } | null> {
  const user = process.env.GMAIL_USER ||
    (await db.select({ value: appSettingsTable.value }).from(appSettingsTable).where(eq(appSettingsTable.key, "gmail_user")))[0]?.value || "";
  const pass = (process.env.GMAIL_APP_PASSWORD ||
    (await db.select({ value: appSettingsTable.value }).from(appSettingsTable).where(eq(appSettingsTable.key, "gmail_app_password")))[0]?.value || "").replace(/\s/g, "");
  if (!user || !pass) return null;
  return { user, pass };
}

// POST /auth/teacher/login
router.post("/auth/teacher/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
  const rows = await db.select().from(teachersTable).where(eq(teachersTable.email, email.toLowerCase().trim()));
  const teacher = rows[0];
  if (!teacher) return res.status(401).json({ error: "Invalid credentials" });
  const valid = await bcrypt.compare(password, teacher.passwordHash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });
  const token = signToken({ id: teacher.id, role: "teacher", name: teacher.name, email: teacher.email });
  const mustChangePassword = await getMustChangePassword(teacher.id);
  logger.info({ teacherId: teacher.id }, "Teacher logged in");
  return res.json({
    token,
    teacher: { id: teacher.id, name: teacher.name, email: teacher.email, employeeId: teacher.employeeId, classAssigned: teacher.classAssigned, subject: teacher.subject, mustChangePassword },
  });
});

// POST /auth/teacher/forgot-password — send OTP to teacher's registered email
router.post("/auth/teacher/forgot-password", async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email?.trim()) return res.status(400).json({ error: "Email is required" });

  const rows = await db.select({ id: teachersTable.id, name: teachersTable.name, email: teachersTable.email })
    .from(teachersTable).where(eq(teachersTable.email, email.toLowerCase().trim()));
  if (!rows[0]) {
    // Don't reveal whether email exists
    return res.json({ ok: true, message: "If this email is registered, an OTP has been sent." });
  }

  const creds = await getGmailCreds();
  if (!creds) return res.status(503).json({ error: "Email service not configured. Please contact the school admin." });

  const otp = generateOtp();
  setOtp(`teacher:${email.toLowerCase().trim()}`, otp);

  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com", port: 587, secure: false,
    auth: { user: creds.user, pass: creds.pass },
    tls: { rejectUnauthorized: false },
  });

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:480px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#f59e0b;padding:20px 28px;text-align:center;">
      <div style="font-size:28px;margin-bottom:4px;">🎓</div>
      <h1 style="margin:0;color:#1e293b;font-size:17px;font-weight:bold;">Teacher Portal — Password Reset</h1>
    </div>
    <div style="padding:28px;">
      <p style="margin:0 0 8px;color:#374151;font-size:15px;">Hello <strong>${rows[0].name}</strong>,</p>
      <p style="margin:0 0 20px;color:#64748b;font-size:14px;">Use the OTP below to reset your password. It expires in <strong>10 minutes</strong>.</p>
      <div style="background:#fef3c7;border:2px dashed #f59e0b;border-radius:10px;padding:20px;text-align:center;margin:0 0 20px;">
        <div style="font-size:38px;font-weight:bold;letter-spacing:10px;color:#92400e;">${otp}</div>
        <div style="font-size:12px;color:#92400e;margin-top:6px;">One-Time Password</div>
      </div>
      <p style="margin:0;color:#94a3b8;font-size:12px;">If you did not request this, ignore this email. Your password will remain unchanged.</p>
    </div>
  </div>
</body></html>`;

  try {
    await transport.sendMail({
      from: `"School Portal" <${creds.user}>`,
      to: rows[0].email,
      subject: "Your OTP for Teacher Portal Password Reset",
      html,
    });
    logger.info({ teacherId: rows[0].id }, "OTP sent for teacher password reset");
  } catch (err: any) {
    logger.error({ err: err.message }, "Failed to send teacher OTP email");
    return res.status(502).json({ error: "Failed to send email. Please try again or contact admin." });
  }

  return res.json({ ok: true, message: "OTP sent to your registered email." });
});

// POST /auth/teacher/reset-password — verify OTP and set new password
router.post("/auth/teacher/reset-password", async (req, res) => {
  const { email, otp, newPassword } = req.body as { email?: string; otp?: string; newPassword?: string };
  if (!email?.trim() || !otp?.trim() || !newPassword?.trim()) {
    return res.status(400).json({ error: "Email, OTP, and new password are required" });
  }
  if (newPassword.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

  if (!verifyOtp(`teacher:${email.toLowerCase().trim()}`, otp.trim())) {
    return res.status(400).json({ error: "Invalid or expired OTP. Please request a new one." });
  }

  const rows = await db.select({ id: teachersTable.id }).from(teachersTable)
    .where(eq(teachersTable.email, email.toLowerCase().trim()));
  if (!rows[0]) return res.status(404).json({ error: "Account not found" });

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.update(teachersTable).set({ passwordHash }).where(eq(teachersTable.id, rows[0].id));

  logger.info({ teacherId: rows[0].id }, "Teacher password reset via OTP");
  return res.json({ ok: true, message: "Password reset successfully. You can now sign in." });
});

// GET /auth/teacher/me
router.get("/auth/teacher/me", requireAuth("teacher"), async (req, res) => {
  const rows = await db.select().from(teachersTable).where(eq(teachersTable.id, req.user!.id));
  const teacher = rows[0];
  if (!teacher) return res.status(404).json({ error: "Not found" });
  const mustChangePassword = await getMustChangePassword(teacher.id);
  return res.json({ id: teacher.id, name: teacher.name, email: teacher.email, employeeId: teacher.employeeId, classAssigned: teacher.classAssigned, sectionAssigned: teacher.sectionAssigned, subject: teacher.subject, mobile: teacher.mobile, mustChangePassword });
});

// POST /auth/teacher/change-password — authenticated, change using old password
router.post("/auth/teacher/change-password", requireAuth("teacher"), async (req, res) => {
  const { oldPassword, newPassword } = req.body as { oldPassword?: string; newPassword?: string };
  if (!oldPassword?.trim() || !newPassword?.trim()) {
    return res.status(400).json({ error: "Old password and new password are required" });
  }
  if (newPassword.length < 6) return res.status(400).json({ error: "New password must be at least 6 characters" });

  const rows = await db.select().from(teachersTable).where(eq(teachersTable.id, req.user!.id));
  const teacher = rows[0];
  if (!teacher) return res.status(404).json({ error: "Account not found" });

  const valid = await bcrypt.compare(oldPassword, teacher.passwordHash);
  if (!valid) return res.status(400).json({ error: "Current password is incorrect" });

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.update(teachersTable).set({ passwordHash }).where(eq(teachersTable.id, teacher.id));
  await clearMustChangePassword(teacher.id);

  logger.info({ teacherId: teacher.id }, "Teacher changed password via old password");
  return res.json({ ok: true, message: "Password changed successfully." });
});

// POST /auth/teacher/send-change-otp — authenticated, send OTP to teacher's own email
router.post("/auth/teacher/send-change-otp", requireAuth("teacher"), async (req, res) => {
  const rows = await db.select({ id: teachersTable.id, name: teachersTable.name, email: teachersTable.email })
    .from(teachersTable).where(eq(teachersTable.id, req.user!.id));
  const teacher = rows[0];
  if (!teacher) return res.status(404).json({ error: "Account not found" });

  const creds = await getGmailCreds();
  if (!creds) return res.status(503).json({ error: "Email service not configured. Please contact the school admin." });

  const otp = generateOtp();
  setOtp(`teacher-change:${teacher.email}`, otp);

  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com", port: 587, secure: false,
    auth: { user: creds.user, pass: creds.pass },
    tls: { rejectUnauthorized: false },
  });

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:480px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#f59e0b;padding:20px 28px;text-align:center;">
      <div style="font-size:28px;margin-bottom:4px;">🎓</div>
      <h1 style="margin:0;color:#1e293b;font-size:17px;font-weight:bold;">Teacher Portal — Change Password</h1>
    </div>
    <div style="padding:28px;">
      <p style="margin:0 0 8px;color:#374151;font-size:15px;">Hello <strong>${teacher.name}</strong>,</p>
      <p style="margin:0 0 20px;color:#64748b;font-size:14px;">Use the OTP below to change your password. It expires in <strong>10 minutes</strong>.</p>
      <div style="background:#fef3c7;border:2px dashed #f59e0b;border-radius:10px;padding:20px;text-align:center;margin:0 0 20px;">
        <div style="font-size:38px;font-weight:bold;letter-spacing:10px;color:#92400e;">${otp}</div>
        <div style="font-size:12px;color:#92400e;margin-top:6px;">One-Time Password</div>
      </div>
      <p style="margin:0;color:#94a3b8;font-size:12px;">If you did not request this, someone else may have access to your account. Please contact the school admin.</p>
    </div>
  </div>
</body></html>`;

  try {
    await transport.sendMail({
      from: `"School Portal" <${creds.user}>`,
      to: teacher.email,
      subject: "Your OTP for Teacher Portal Password Change",
      html,
    });
    logger.info({ teacherId: teacher.id }, "OTP sent for teacher password change");
  } catch (err: any) {
    logger.error({ err: err.message }, "Failed to send teacher change-password OTP email");
    return res.status(502).json({ error: "Failed to send email. Please try again or contact admin." });
  }

  return res.json({ ok: true, message: "OTP sent to your registered email." });
});

// POST /auth/teacher/change-password-otp — authenticated, verify OTP and set new password
router.post("/auth/teacher/change-password-otp", requireAuth("teacher"), async (req, res) => {
  const { otp, newPassword } = req.body as { otp?: string; newPassword?: string };
  if (!otp?.trim() || !newPassword?.trim()) {
    return res.status(400).json({ error: "OTP and new password are required" });
  }
  if (newPassword.length < 6) return res.status(400).json({ error: "New password must be at least 6 characters" });

  const rows = await db.select({ id: teachersTable.id, email: teachersTable.email })
    .from(teachersTable).where(eq(teachersTable.id, req.user!.id));
  const teacher = rows[0];
  if (!teacher) return res.status(404).json({ error: "Account not found" });

  if (!verifyOtp(`teacher-change:${teacher.email}`, otp.trim())) {
    return res.status(400).json({ error: "Invalid or expired OTP. Please request a new one." });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.update(teachersTable).set({ passwordHash }).where(eq(teachersTable.id, teacher.id));
  await clearMustChangePassword(teacher.id);

  logger.info({ teacherId: teacher.id }, "Teacher changed password via OTP");
  return res.json({ ok: true, message: "Password changed successfully." });
});

export default router;
