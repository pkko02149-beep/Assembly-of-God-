import { db, studentsTable, attendanceTable, appSettingsTable, classesTable, sectionsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { sendEmail } from "./mailer";
import { logger } from "./logger";

export async function buildAndSendDailyReport(date: string): Promise<void> {
  try {
    const rows = await db
      .select({ key: appSettingsTable.key, value: appSettingsTable.value })
      .from(appSettingsTable)
      .where(inArray(appSettingsTable.key, ["daily_report_email", "school_name"]));

    const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const recipientEmail = settings["daily_report_email"];
    const schoolName = settings["school_name"] || "School";

    if (!recipientEmail) {
      logger.warn("daily_report_email not configured — skipping daily report");
      return;
    }

    const attendance = await db
      .select({
        studentId: attendanceTable.studentId,
        status: attendanceTable.status,
        studentName: studentsTable.studentName,
        className: classesTable.name,
        sectionName: sectionsTable.name,
      })
      .from(attendanceTable)
      .leftJoin(studentsTable, eq(studentsTable.id, attendanceTable.studentId))
      .leftJoin(classesTable, eq(classesTable.id, studentsTable.classId))
      .leftJoin(sectionsTable, eq(sectionsTable.id, studentsTable.sectionId))
      .where(eq(attendanceTable.date, date));

    const present = attendance.filter((a) => a.status === "present").length;
    const absent = attendance.filter((a) => a.status === "absent").length;
    const late = attendance.filter((a) => a.status === "late").length;
    const total = attendance.length;

    const absentList = attendance
      .filter((a) => a.status === "absent")
      .map((a) => `  - ${a.studentName} (${a.className || ""} ${a.sectionName || ""})`)
      .join("\n");

    const text = `Daily Attendance Report — ${date}
School: ${schoolName}

Summary:
  Total: ${total}
  Present: ${present}
  Absent: ${absent}
  Late: ${late}

Absent Students:
${absentList || "  None"}
`;

    await sendEmail({
      to: recipientEmail,
      subject: `Daily Attendance Report — ${date} — ${schoolName}`,
      text,
    });

    logger.info({ date, total, present, absent }, "Daily report sent");
  } catch (err) {
    logger.error({ err }, "buildAndSendDailyReport failed");
    throw err;
  }
}
