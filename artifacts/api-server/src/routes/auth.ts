import { Router } from "express";
import { db, appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { signToken } from "../lib/jwt";
import { logAudit } from "../lib/audit";
import nodemailer from "nodemailer";

const router = Router();

interface OtpEntry {
  otp: string;
  expiry: number;
}
const otpStore = new Map<string, OtpEntry>();

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function getSetting(key: string): Promise<string> {
  const rows = await db
    .select({ value: appSettingsTable.value })
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, key));
  return rows[0]?.value ?? "";
}

async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(appSettingsTable)
    .values({ key, value })
    .onConflictDoUpdate({
      target: appSettingsTable.key,
      set: { value, updatedAt: new Date() },
    });
}

// POST /auth/login — validate credentials against DB
router.post("/auth/login", async (req, res) => {
  const { username, password } = req.body as {
    username?: string;
    password?: string;
  };
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  const storedUsername = (await getSetting("admin_username")) || "admin";
  const storedPassword = (await getSetting("admin_password")) || "admin123";

  if (username === storedUsername && password === storedPassword) {
    const token = signToken({ id: 0, role: "admin", name: "admin", email: "" });
    await logAudit({
      action: "admin_login",
      description: `Admin login successful (username: ${username})`,
      entityType: "auth",
    });
    return res.json({ ok: true, token });
  }

  await logAudit({
    action: "admin_login_failed",
    description: `Failed admin login attempt (username: ${username})`,
    entityType: "auth",
    metadata: { username },
  });
  return res.status(401).json({ error: "Invalid credentials" });
});

// POST /auth/request-otp — generate and email OTP to admin gmail
router.post("/auth/request-otp", async (req, res) => {
  const { purpose } = req.body as { purpose?: string };
  if (!purpose) {
    return res.status(400).json({ error: "purpose is required" });
  }

  const adminGmail = await getSetting("admin_gmail");
  if (!adminGmail) {
    return res.status(400).json({
      error:
        "Admin Gmail not configured. Please set it in Security settings first.",
    });
  }

  const gmailUser =
    process.env.GMAIL_USER || (await getSetting("gmail_user"));
  const gmailPass = (
    process.env.GMAIL_APP_PASSWORD || (await getSetting("gmail_app_password"))
  ).replace(/\s/g, "");

  if (!gmailUser || !gmailPass) {
    return res.status(400).json({
      error:
        "Gmail SMTP not configured. Please configure Gmail for Notifications first.",
    });
  }

  const otp = generateOtp();
  otpStore.set(purpose, { otp, expiry: Date.now() + 5 * 60 * 1000 });

  const purposeLabel =
    purpose === "forgot-password" ? "password reset" : "credential change";

  try {
    const t = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user: gmailUser, pass: gmailPass },
      tls: { rejectUnauthorized: false },
    });

    const schoolName = await getSetting("school_name").catch(() => "");
    await t.sendMail({
      from: `"${schoolName || "School"} Admin" <${gmailUser}>`,
      to: adminGmail,
      subject: `Admin OTP: ${otp} — ${schoolName || "School"} Portal`,
      html: `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:420px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#f59e0b;padding:20px 28px;text-align:center;">
      <div style="font-size:28px;margin-bottom:4px;">🔐</div>
      <h1 style="margin:0;color:#1e293b;font-size:17px;font-weight:bold;">${schoolName || "School"}</h1>
      <p style="margin:4px 0 0;color:#1e293b;font-size:13px;opacity:0.85;">Admin Portal — Security OTP</p>
    </div>
    <div style="padding:28px;">
      <p style="color:#475569;margin:0 0 20px;font-size:15px;">Your one-time password for <strong>${purposeLabel}</strong>:</p>
      <div style="background:#f8fafc;border:2px solid #f59e0b;border-radius:10px;padding:24px;text-align:center;margin-bottom:20px;">
        <span style="font-size:40px;font-weight:bold;letter-spacing:10px;color:#1e293b;">${otp}</span>
      </div>
      <p style="color:#94a3b8;font-size:13px;margin:0;">Valid for <strong>5 minutes</strong>. Do not share this code with anyone.</p>
    </div>
    <div style="padding:12px 28px;border-top:1px solid #e2e8f0;text-align:center;">
      <p style="margin:0 0 4px;color:#374151;font-size:13px;font-weight:600;">${schoolName || "School"}</p>
      <p style="margin:0;color:#94a3b8;font-size:11px;">Automated security alert — do not share this OTP.</p>
    </div>
  </div>
</body>
</html>`,
    });

    logger.info({ purpose, adminGmail }, "OTP sent to admin Gmail");
    await logAudit({
      action: "otp_requested",
      description: `OTP requested for ${purposeLabel}`,
      entityType: "auth",
      metadata: { purpose },
    });
    return res.json({ ok: true, message: `OTP sent to ${adminGmail}` });
  } catch (err: any) {
    logger.error({ err: err.message }, "Failed to send OTP email");
    otpStore.delete(purpose);
    return res
      .status(500)
      .json({ error: "Failed to send OTP email. Check Gmail configuration." });
  }
});

// POST /auth/change-credentials — verify OTP then update credentials in DB
router.post("/auth/change-credentials", async (req, res) => {
  const { otp, purpose, newUsername, newPassword } = req.body as {
    otp?: string;
    purpose?: string;
    newUsername?: string;
    newPassword?: string;
  };

  if (!otp || !purpose || !newPassword) {
    return res
      .status(400)
      .json({ error: "otp, purpose, and newPassword are required" });
  }

  const entry = otpStore.get(purpose);
  if (!entry) {
    return res
      .status(400)
      .json({ error: "No OTP found. Please request a new OTP." });
  }
  if (Date.now() > entry.expiry) {
    otpStore.delete(purpose);
    return res
      .status(400)
      .json({ error: "OTP has expired. Please request a new one." });
  }
  if (entry.otp !== otp) {
    return res.status(400).json({ error: "Invalid OTP. Please try again." });
  }
  otpStore.delete(purpose);

  const changedFields: string[] = [];
  if (newUsername) {
    await setSetting("admin_username", newUsername.trim());
    changedFields.push("username");
  }
  await setSetting("admin_password", newPassword);
  changedFields.push("password");

  await logAudit({
    action: "credentials_changed",
    description: `Admin credentials updated: ${changedFields.join(", ")} changed`,
    entityType: "auth",
    metadata: { changedFields, purpose },
  });

  logger.info({ purpose }, "Admin credentials updated via OTP");
  return res.json({ ok: true, message: "Credentials updated successfully." });
});

export default router;
