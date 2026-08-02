import { Router } from "express";
import nodemailer from "nodemailer";
import { db, appSettingsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

async function getSetting(key: string): Promise<string> {
  const rows = await db
    .select({ value: appSettingsTable.value })
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, key));
  return rows[0]?.value ?? "";
}

async function getSettings(keys: string[]): Promise<Record<string, string>> {
  const rows = await db
    .select({ key: appSettingsTable.key, value: appSettingsTable.value })
    .from(appSettingsTable)
    .where(inArray(appSettingsTable.key, keys));
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

interface BulkEmailRecipient {
  email: string;
  studentName: string;
  fatherName?: string;
}

// POST /email/bulk — send a custom email to multiple parent addresses
router.post("/email/bulk", async (req, res) => {
  const { recipients, subject, message } = req.body as {
    recipients?: BulkEmailRecipient[];
    subject?: string;
    message?: string;
  };

  if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ error: "recipients array is required" });
  }
  if (!subject?.trim()) {
    return res.status(400).json({ error: "subject is required" });
  }
  if (!message?.trim()) {
    return res.status(400).json({ error: "message is required" });
  }

  const gmailUser =
    process.env.GMAIL_USER || (await getSetting("gmail_user"));
  const gmailPass = (
    process.env.GMAIL_APP_PASSWORD || (await getSetting("gmail_app_password"))
  ).replace(/\s/g, "");

  if (!gmailUser || !gmailPass) {
    return res.status(400).json({
      error:
        "Gmail not configured. Please set up Gmail for Notifications in the Security tab.",
    });
  }

  const schoolSettings = await getSettings(["school_name", "school_address", "school_contact_number", "school_email"]).catch(() => ({} as Record<string, string>));
  const schoolName = schoolSettings["school_name"] || "School";
  const schoolAddress = schoolSettings["school_address"] || "";
  const schoolPhone = schoolSettings["school_contact_number"] || "";
  const schoolEmailVal = schoolSettings["school_email"] || "";

  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user: gmailUser, pass: gmailPass },
    tls: { rejectUnauthorized: false },
  });

  const results: Array<{ email: string; studentName: string; ok: boolean; error?: string }> = [];

  for (const r of recipients) {
    const personalisedHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#f59e0b;padding:20px 28px;text-align:center;">
      <div style="font-size:28px;margin-bottom:4px;">🚌</div>
      <h1 style="margin:0;color:#1e293b;font-size:19px;font-weight:bold;">${schoolName}</h1>
      <p style="margin:4px 0 0;color:#1e293b;font-size:12px;opacity:0.85;">Parent Notification</p>
    </div>
    <div style="padding:24px 28px;">
      <p style="margin:0 0 6px;color:#64748b;font-size:13px;">Dear parent of <strong>${r.studentName}</strong>${r.fatherName ? ` (Father: ${r.fatherName})` : ""},</p>
      <div style="margin:16px 0;color:#1e293b;font-size:15px;line-height:1.7;white-space:pre-wrap;">${message.trim()}</div>
    </div>
    <div style="padding:12px 28px;border-top:1px solid #e2e8f0;text-align:center;">
      <p style="margin:0 0 4px;color:#374151;font-size:13px;font-weight:600;">${schoolName}</p>
      ${schoolAddress ? `<p style="margin:0 0 2px;color:#64748b;font-size:11px;">${schoolAddress}</p>` : ""}
      ${(schoolPhone || schoolEmailVal) ? `<p style="margin:0;color:#64748b;font-size:11px;">${[schoolPhone, schoolEmailVal].filter(Boolean).join(" · ")}</p>` : ""}
      <p style="margin:4px 0 0;color:#94a3b8;font-size:11px;">Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>`;

    try {
      await transport.sendMail({
        from: `"${schoolName}" <${gmailUser}>`,
        to: r.email.trim(),
        subject: subject.trim(),
        html: personalisedHtml,
      });
      results.push({ email: r.email, studentName: r.studentName, ok: true });
      logger.info({ to: r.email, student: r.studentName }, "Bulk email sent");
    } catch (err: any) {
      results.push({
        email: r.email,
        studentName: r.studentName,
        ok: false,
        error: err.message,
      });
      logger.error(
        { to: r.email, err: err.message },
        "Bulk email failed for recipient",
      );
    }
  }

  const sent = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  return res.json({ ok: true, sent, failed, results });
});

export default router;
