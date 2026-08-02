import { Router } from "express";
import { db, appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifyMailer } from "../lib/mailer";
import { logger } from "../lib/logger";

const router = Router();

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

// GET /settings/gmail — returns current Gmail config (password masked)
router.get("/settings/gmail", async (_req, res) => {
  const gmailUser = await getSetting("gmail_user");
  const gmailPass = await getSetting("gmail_app_password");
  res.json({
    gmailUser,
    gmailAppPassword: gmailPass ? "********" : "",
    configured: !!(gmailUser && gmailPass),
  });
});

// POST /settings/gmail — save Gmail credentials
router.post("/settings/gmail", async (req, res) => {
  const { gmailUser, gmailAppPassword } = req.body as {
    gmailUser?: string;
    gmailAppPassword?: string;
  };

  if (!gmailUser || !gmailAppPassword) {
    return res.status(400).json({ error: "gmailUser and gmailAppPassword are required" });
  }

  await setSetting("gmail_user", gmailUser.trim());
  await setSetting("gmail_app_password", gmailAppPassword.replace(/\s/g, ""));

  process.env.GMAIL_USER = gmailUser.trim();
  process.env.GMAIL_APP_PASSWORD = gmailAppPassword.replace(/\s/g, "");

  try {
    await verifyMailer();
    logger.info({ gmailUser }, "Gmail credentials updated and verified");
    return res.json({ ok: true, verified: true, message: "Gmail settings saved and connection verified." });
  } catch (err: any) {
    logger.warn({ err: err.message }, "Gmail credentials saved but SMTP verification failed");
    return res.json({ ok: true, verified: false, message: "Gmail settings saved but SMTP verification failed. Check your App Password." });
  }
});

// GET /settings/admin-gmail — returns the admin inbox Gmail address
router.get("/settings/admin-gmail", async (_req, res) => {
  const adminGmail = await getSetting("admin_gmail");
  res.json({ adminGmail, configured: !!adminGmail });
});

// POST /settings/admin-gmail — save the admin inbox Gmail address
router.post("/settings/admin-gmail", async (req, res) => {
  const { adminGmail } = req.body as { adminGmail?: string };
  if (!adminGmail || !adminGmail.trim()) {
    return res.status(400).json({ error: "adminGmail is required" });
  }
  await setSetting("admin_gmail", adminGmail.trim());
  logger.info({ adminGmail }, "Admin Gmail updated");
  return res.json({ ok: true });
});

// POST /settings/gmail/test — send a test email
router.post("/settings/gmail/test", async (req, res) => {
  const gmailUser = process.env.GMAIL_USER || await getSetting("gmail_user");
  if (!gmailUser) {
    return res.status(400).json({ error: "Gmail not configured yet" });
  }

  const nodemailer = await import("nodemailer");
  const pass = (process.env.GMAIL_APP_PASSWORD || await getSetting("gmail_app_password")).replace(/\s/g, "");
  const t = nodemailer.default.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user: gmailUser, pass },
    tls: { rejectUnauthorized: false },
  });

  try {
    const schoolName = await getSetting("school_name").catch(() => "");
    await t.sendMail({
      from: `"${schoolName || "School"}" <${gmailUser}>`,
      to: gmailUser,
      subject: "Test Email — Gmail Integration Working",
      html: `<p>This is a test email from ${schoolName || "School"}.<br>Gmail integration is working correctly.</p>`,
    });
    logger.info({ gmailUser }, "Test email sent");
    return res.json({ ok: true, message: `Test email sent to ${gmailUser}` });
  } catch (err: any) {
    logger.error({ err: err.message }, "Test email failed");
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── School Info ───────────────────────────────────────────────

// GET /settings/school-info — returns school identity fields
router.get("/settings/school-info", async (_req, res) => {
  const [schoolName, udiseCode, logoUrl, address, contactNumber, receiptFooter, schoolGmail, registrationNo, schoolWebsite, schoolMotto, mapsUrl] = await Promise.all([
    getSetting("school_name"),
    getSetting("school_udise_code"),
    getSetting("school_logo_url"),
    getSetting("school_address"),
    getSetting("school_contact_number"),
    getSetting("school_receipt_footer"),
    getSetting("school_gmail"),
    getSetting("school_registration_no"),
    getSetting("school_website"),
    getSetting("school_motto"),
    getSetting("school_maps_url"),
  ]);
  res.json({ schoolName, udiseCode, logoUrl, address, contactNumber, receiptFooter, schoolGmail, registrationNo, schoolWebsite, schoolMotto, mapsUrl });
});

// POST /settings/school-info — save school identity fields
router.post("/settings/school-info", async (req, res) => {
  const { schoolName, udiseCode, logoUrl, address, contactNumber, receiptFooter, schoolGmail, registrationNo, schoolWebsite, schoolMotto, mapsUrl } = req.body as {
    schoolName?: string;
    udiseCode?: string;
    logoUrl?: string;
    address?: string;
    contactNumber?: string;
    receiptFooter?: string;
    schoolGmail?: string;
    registrationNo?: string;
    schoolWebsite?: string;
    schoolMotto?: string;
    mapsUrl?: string;
  };

  await Promise.all([
    setSetting("school_name", schoolName?.trim() ?? ""),
    setSetting("school_udise_code", udiseCode?.trim() ?? ""),
    setSetting("school_logo_url", logoUrl?.trim() ?? ""),
    setSetting("school_address", address?.trim() ?? ""),
    setSetting("school_contact_number", contactNumber?.trim() ?? ""),
    setSetting("school_receipt_footer", receiptFooter?.trim() ?? ""),
    setSetting("school_gmail", schoolGmail?.trim() ?? ""),
    setSetting("school_registration_no", registrationNo?.trim() ?? ""),
    setSetting("school_website", schoolWebsite?.trim() ?? ""),
    setSetting("school_motto", schoolMotto?.trim() ?? ""),
    setSetting("school_maps_url", mapsUrl?.trim() ?? ""),
  ]);

  logger.info("School info updated");
  return res.json({ ok: true });
});

// ─── Cloudinary Settings ────────────────────────────────────────────────────

router.get("/settings/cloudinary", async (_req, res) => {
  try {
    const cloudName = await getSetting("cloudinary_cloud_name");
    const uploadPreset = await getSetting("cloudinary_upload_preset");
    res.json({ cloudName, uploadPreset, configured: !!(cloudName && uploadPreset) });
  } catch (err) {
    logger.error({ err }, "settings/cloudinary GET error");
    res.status(500).json({ error: "Failed to load Cloudinary settings" });
  }
});

router.post("/settings/cloudinary", async (req, res) => {
  try {
    const { cloudName, uploadPreset } = req.body as { cloudName?: string; uploadPreset?: string };
    await Promise.all([
      setSetting("cloudinary_cloud_name", cloudName?.trim() ?? ""),
      setSetting("cloudinary_upload_preset", uploadPreset?.trim() ?? ""),
    ]);
    logger.info("Cloudinary settings updated");
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "settings/cloudinary POST error");
    res.status(500).json({ error: "Failed to save Cloudinary settings" });
  }
});

export default router;
export { getSetting, setSetting };
