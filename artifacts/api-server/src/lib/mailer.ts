import nodemailer from "nodemailer";
import { db, appSettingsTable, studentsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { logger } from "./logger";

async function getGmailCreds(): Promise<{ user: string; pass: string } | null> {
  const rows = await db
    .select({ key: appSettingsTable.key, value: appSettingsTable.value })
    .from(appSettingsTable)
    .where(inArray(appSettingsTable.key, ["gmail_user", "gmail_app_password"]));
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const user = process.env.GMAIL_USER || map["gmail_user"] || "";
  const pass = (process.env.GMAIL_APP_PASSWORD || map["gmail_app_password"] || "").replace(/\s/g, "");
  if (!user || !pass) return null;
  return { user, pass };
}

function createTransporter(creds: { user: string; pass: string }) {
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: creds.user, pass: creds.pass },
  });
}

export async function verifyMailer(): Promise<{ success: boolean; message: string }> {
  try {
    const creds = await getGmailCreds();
    if (!creds) return { success: false, message: "Gmail credentials not configured" };
    const transporter = createTransporter(creds);
    await transporter.verify();
    return { success: true, message: "Mailer verified successfully" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: msg };
  }
}

export async function sendAttendanceEmail(params: {
  parentEmail: string;
  studentName: string;
  fatherName?: string;
  className?: string;
  sectionName?: string;
  vehicleName?: string | null;
  status: string;
  date: string;
  time?: string;
  schoolName?: string;
  schoolAddress?: string;
  schoolPhone?: string;
  schoolEmail?: string;
}): Promise<void> {
  try {
    const creds = await getGmailCreds();
    if (!creds) return;

    const transporter = createTransporter(creds);
    const statusLabel = params.status === "present" ? "Present" : params.status === "absent" ? "Absent" : params.status;

    await transporter.sendMail({
      from: creds.user,
      to: params.parentEmail,
      subject: `Attendance Update: ${params.studentName} — ${params.date}`,
      text: `Dear Parent,\n\nThis is to inform you that ${params.studentName} was marked ${statusLabel} on ${params.date}.\n\nRegards,\n${params.schoolName || "School Management"}`,
    });
  } catch (err) {
    logger.error({ err }, "Failed to send attendance email");
  }
}

export async function sendEmail(params: {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
}): Promise<void> {
  const creds = await getGmailCreds();
  if (!creds) throw new Error("Gmail credentials not configured");
  const transporter = createTransporter(creds);
  await transporter.sendMail({
    from: creds.user,
    to: Array.isArray(params.to) ? params.to.join(",") : params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
  });
}

export async function sendAdmissionEmail(params: {
  parentEmail: string;
  /** Provide for new parent accounts. Omit for existing parents (no credentials sent). */
  parentPassword?: string;
  studentName: string;
  fatherName?: string;
  motherName?: string;
  className?: string;
  sectionName?: string;
  uniqueId?: string;
  gender?: string;
  dateOfBirth?: string;
  admissionDate?: string;
  bloodGroup?: string;
  address?: string;
  whatsappNumber?: string;
  photoUrl?: string;
  session?: string;
  portalUrl?: string;
  schoolName?: string;
  schoolAddress?: string;
  schoolPhone?: string;
  schoolEmail?: string;
  schoolLogoUrl?: string;
}): Promise<void> {
  const isNewParent = !!params.parentPassword;

  const creds = await getGmailCreds();
  if (!creds) {
    logger.warn("Admission email skipped — Gmail not configured");
    return;
  }

  const school = params.schoolName || "School Management";
  const portalUrl = params.portalUrl || "";
  const parentPortalLink = portalUrl ? `${portalUrl}/parent/login` : "";

  // ── Shared student detail rows ──────────────────────────────────────────────
  const detailRows: Array<[string, string]> = [];
  if (params.uniqueId) detailRows.push(["Admission No.", params.uniqueId]);
  if (params.studentName) detailRows.push(["Student Name", params.studentName]);
  if (params.fatherName) detailRows.push(["Father's Name", params.fatherName]);
  if (params.motherName) detailRows.push(["Mother's Name", params.motherName]);
  if (params.className || params.sectionName)
    detailRows.push(["Class / Section", [params.className, params.sectionName].filter(Boolean).join(" — ")]);
  if (params.session) detailRows.push(["Academic Session", params.session]);
  if (params.gender) detailRows.push(["Gender", params.gender]);
  if (params.dateOfBirth) detailRows.push(["Date of Birth", params.dateOfBirth]);
  if (params.admissionDate) detailRows.push(["Admission Date", params.admissionDate]);
  if (params.bloodGroup) detailRows.push(["Blood Group", params.bloodGroup]);
  if (params.address) detailRows.push(["Address", params.address]);
  if (params.whatsappNumber) detailRows.push(["WhatsApp", params.whatsappNumber]);

  const detailRowsHtml = detailRows.map(([label, value], i) => `
    <tr style="background:${i % 2 === 0 ? "#f8fafc" : "#ffffff"};">
      <td style="padding:9px 14px;color:#64748b;font-size:13px;font-weight:600;white-space:nowrap;width:38%;">${label}</td>
      <td style="padding:9px 14px;color:#1e293b;font-size:13px;">${value}</td>
    </tr>`).join("");

  const photoSection = params.photoUrl ? `
    <div style="text-align:center;margin:20px 0 4px;">
      <img src="${params.photoUrl}" alt="Student Photo"
        style="width:96px;height:96px;border-radius:50%;object-fit:cover;border:3px solid #3b82f6;box-shadow:0 2px 8px rgba(59,130,246,0.25);" />
    </div>` : "";

  const schoolHeader = `
    <div style="background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);padding:28px 32px;text-align:center;">
      ${params.schoolLogoUrl
        ? `<img src="${params.schoolLogoUrl}" alt="${school} Logo" style="height:52px;object-fit:contain;margin-bottom:10px;display:block;margin-left:auto;margin-right:auto;" />`
        : `<div style="width:52px;height:52px;background:rgba(255,255,255,0.15);border-radius:12px;display:inline-flex;align-items:center;justify-content:center;font-size:24px;margin-bottom:10px;">🏫</div>`}
      <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.3px;">${school}</h1>
      ${params.schoolAddress ? `<p style="margin:4px 0 0;color:rgba(255,255,255,0.75);font-size:12px;">${params.schoolAddress}</p>` : ""}
    </div>`;

  const schoolFooter = `
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;text-align:center;">
      <p style="margin:0 0 3px;color:#374151;font-size:13px;font-weight:600;">${school}</p>
      ${params.schoolAddress ? `<p style="margin:0 0 2px;color:#64748b;font-size:11px;">${params.schoolAddress}</p>` : ""}
      ${[params.schoolPhone, params.schoolEmail].filter(Boolean).length > 0
        ? `<p style="margin:0 0 2px;color:#64748b;font-size:11px;">${[params.schoolPhone, params.schoolEmail].filter(Boolean).join(" · ")}</p>` : ""}
      <p style="margin:8px 0 0;color:#94a3b8;font-size:11px;">This is an automated email. Please do not reply directly to this message.</p>
    </div>`;

  let html: string;
  let subject: string;

  if (isNewParent) {
    // ── NEW PARENT: full email with credentials + login guide ─────────────────
    const guideSteps = [
      { n: 1, text: `Open the Parent Portal: <a href="${parentPortalLink}" style="color:#3b82f6;text-decoration:underline;">${parentPortalLink || "(URL provided by school)"}</a>` },
      { n: 2, text: `Click <strong>"Parent Login"</strong> on the homepage.` },
      { n: 3, text: `Enter your registered email: <strong>${params.parentEmail}</strong>` },
      { n: 4, text: `Enter the temporary password shown below.` },
      { n: 5, text: `You will be asked to <strong>set a new permanent password</strong> immediately after logging in for the first time.` },
      { n: 6, text: `Once inside, you can view your child's attendance, homework, results, notices and fee status.` },
    ];

    const guideHtml = guideSteps.map(s => `
      <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;">
        <div style="min-width:26px;height:26px;background:#3b82f6;color:#fff;border-radius:50%;font-size:12px;font-weight:700;flex-shrink:0;text-align:center;line-height:26px;">${s.n}</div>
        <div style="color:#374151;font-size:13px;line-height:1.6;padding-top:4px;">${s.text}</div>
      </div>`).join("");

    subject = `🎉 Admission Confirmed — ${params.studentName} | ${school}`;
    html = `<!DOCTYPE html><html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:580px;margin:28px auto;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.10);">
    ${schoolHeader}
    <div style="background:#dcfce7;border-bottom:2px solid #86efac;padding:14px 32px;text-align:center;">
      <span style="font-size:20px;">🎉</span>
      <span style="color:#166534;font-size:16px;font-weight:700;margin-left:8px;">Admission Confirmed!</span>
      <p style="margin:4px 0 0;color:#15803d;font-size:13px;">Welcome to ${school}. Your child has been successfully admitted.</p>
    </div>
    <div style="padding:24px 32px;">
      ${photoSection}
      <h2 style="margin:16px 0 8px;color:#1e293b;font-size:15px;font-weight:700;border-left:3px solid #3b82f6;padding-left:10px;">Student Details</h2>
      <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;">${detailRowsHtml}</table>

      <div style="margin-top:22px;background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:10px;padding:18px 20px;">
        <h2 style="margin:0 0 12px;color:#1e40af;font-size:15px;font-weight:700;">🔐 Parent Portal Login Credentials</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:7px 0;color:#64748b;font-size:13px;font-weight:600;width:36%;">Login Email</td>
            <td style="padding:7px 0;color:#1e293b;font-size:13px;font-weight:700;">${params.parentEmail}</td>
          </tr>
          <tr>
            <td style="padding:7px 0;color:#64748b;font-size:13px;font-weight:600;">Temporary Password</td>
            <td style="padding:7px 0;"><span style="font-family:monospace;font-size:16px;font-weight:700;color:#1d4ed8;background:#dbeafe;padding:4px 10px;border-radius:6px;letter-spacing:1px;">${params.parentPassword}</span></td>
          </tr>
          ${parentPortalLink ? `<tr>
            <td style="padding:7px 0;color:#64748b;font-size:13px;font-weight:600;">Portal Link</td>
            <td style="padding:7px 0;"><a href="${parentPortalLink}" style="color:#2563eb;font-size:13px;">${parentPortalLink}</a></td>
          </tr>` : ""}
        </table>
        <div style="margin-top:12px;padding:10px;background:#fef9c3;border:1px solid #fde047;border-radius:7px;color:#713f12;font-size:12px;line-height:1.5;">
          ⚠️ <strong>Important:</strong> This is a one-time temporary password. You <strong>must change it</strong> on your first login. Keep this email safe and do not share your password with anyone.
        </div>
      </div>

      <div style="margin-top:22px;">
        <h2 style="margin:0 0 12px;color:#1e293b;font-size:15px;font-weight:700;border-left:3px solid #10b981;padding-left:10px;">📋 How to Log In — Step by Step</h2>
        ${guideHtml}
      </div>

      ${parentPortalLink ? `
      <div style="text-align:center;margin:24px 0 8px;">
        <a href="${parentPortalLink}" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:14px;font-weight:700;padding:12px 32px;border-radius:8px;text-decoration:none;">Login to Parent Portal →</a>
      </div>` : ""}
    </div>
    ${schoolFooter}
  </div>
</body></html>`;
  } else {
    // ── EXISTING PARENT: student details only, no credentials ─────────────────
    subject = `📚 New Admission — ${params.studentName} | ${school}`;
    html = `<!DOCTYPE html><html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:580px;margin:28px auto;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.10);">
    ${schoolHeader}
    <div style="background:#eff6ff;border-bottom:2px solid #bfdbfe;padding:14px 32px;text-align:center;">
      <span style="font-size:20px;">📚</span>
      <span style="color:#1e40af;font-size:16px;font-weight:700;margin-left:8px;">Another Child Admitted!</span>
      <p style="margin:4px 0 0;color:#1d4ed8;font-size:13px;">${params.studentName} has been successfully admitted to ${school}.</p>
    </div>
    <div style="padding:24px 32px;">
      <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.6;">
        Dear Parent, we are pleased to inform you that another child linked to your account has been admitted. Below are the details:
      </p>
      ${photoSection}
      <h2 style="margin:16px 0 8px;color:#1e293b;font-size:15px;font-weight:700;border-left:3px solid #3b82f6;padding-left:10px;">Student Details</h2>
      <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;">${detailRowsHtml}</table>

      <div style="margin-top:20px;background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;padding:14px 18px;">
        <p style="margin:0;color:#166534;font-size:13px;line-height:1.6;">
          ✅ You can view this child's attendance, homework, results and fee details through your existing Parent Portal account.
          ${parentPortalLink ? `<br/><br/><a href="${parentPortalLink}" style="color:#2563eb;font-weight:700;">Open Parent Portal →</a>` : ""}
        </p>
      </div>
      ${parentPortalLink ? `
      <div style="text-align:center;margin:22px 0 8px;">
        <a href="${parentPortalLink}" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:14px;font-weight:700;padding:12px 32px;border-radius:8px;text-decoration:none;">Go to Parent Portal →</a>
      </div>` : ""}
    </div>
    ${schoolFooter}
  </div>
</body></html>`;
  }

  const transporter = createTransporter(creds);
  try {
    await transporter.sendMail({
      from: `"${school}" <${creds.user}>`,
      to: params.parentEmail,
      subject,
      html,
    });
    logger.info({ to: params.parentEmail, student: params.studentName, isNewParent }, "Admission email sent");
  } finally {
    transporter.close();
  }
}
