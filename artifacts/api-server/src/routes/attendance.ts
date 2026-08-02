import { Router } from "express";
import { db, attendanceTable, studentsTable, classesTable, sectionsTable, vehiclesTable, appSettingsTable } from "@workspace/db";
import { eq, and, inArray, gte, lte, type SQL } from "drizzle-orm";
import { sendAttendanceEmail } from "../lib/mailer";
import { requireAuth } from "../lib/auth-middleware";

async function getSettings(keys: string[]): Promise<Record<string, string>> {
  const rows = await db
    .select({ key: appSettingsTable.key, value: appSettingsTable.value })
    .from(appSettingsTable)
    .where(inArray(appSettingsTable.key, keys));
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

const router = Router();

// GET /attendance - list with filters
router.get("/attendance", async (req, res) => {
  const { date, dateFrom, dateTo, classId, sectionId, studentId, status } = req.query;

  const conditions: SQL[] = [];
  if (date && typeof date === "string") conditions.push(eq(attendanceTable.date, date));
  if (dateFrom && typeof dateFrom === "string") conditions.push(gte(attendanceTable.date, dateFrom));
  if (dateTo && typeof dateTo === "string") conditions.push(lte(attendanceTable.date, dateTo));
  if (classId) { const id = parseInt(classId as string, 10); if (!isNaN(id)) conditions.push(eq(attendanceTable.classId, id)); }
  if (sectionId) { const id = parseInt(sectionId as string, 10); if (!isNaN(id)) conditions.push(eq(attendanceTable.sectionId, id)); }
  if (studentId) { const id = parseInt(studentId as string, 10); if (!isNaN(id)) conditions.push(eq(attendanceTable.studentId, id)); }
  if (status && (status === "present" || status === "absent")) conditions.push(eq(attendanceTable.status, status));

  const rows = await db
    .select({
      id: attendanceTable.id,
      studentId: attendanceTable.studentId,
      studentName: studentsTable.studentName,
      fatherName: studentsTable.fatherName,
      whatsappNumber: studentsTable.whatsappNumber,
      classId: attendanceTable.classId,
      className: classesTable.name,
      sectionId: attendanceTable.sectionId,
      sectionName: sectionsTable.name,
      date: attendanceTable.date,
      status: attendanceTable.status,
    })
    .from(attendanceTable)
    .leftJoin(studentsTable, eq(attendanceTable.studentId, studentsTable.id))
    .leftJoin(classesTable, eq(attendanceTable.classId, classesTable.id))
    .leftJoin(sectionsTable, eq(attendanceTable.sectionId, sectionsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(attendanceTable.date, studentsTable.studentName);

  res.json(rows);
});

// GET /attendance/monthly-stats - per-student stats for a given month
router.get("/attendance/monthly-stats", async (req, res) => {
  const now = new Date();
  const year = parseInt((req.query.year as string) || String(now.getFullYear()), 10);
  const month = parseInt((req.query.month as string) || String(now.getMonth() + 1), 10);

  // Build date range for the month
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateFrom = `${year}-${pad(month)}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const dateTo = `${year}-${pad(month)}-${pad(lastDay)}`;

  const rows = await db
    .select({
      studentId: attendanceTable.studentId,
      status: attendanceTable.status,
    })
    .from(attendanceTable)
    .where(and(gte(attendanceTable.date, dateFrom), lte(attendanceTable.date, dateTo)));

  const statsMap = new Map<number, { present: number; absent: number }>();
  for (const row of rows) {
    if (!statsMap.has(row.studentId)) statsMap.set(row.studentId, { present: 0, absent: 0 });
    const s = statsMap.get(row.studentId)!;
    if (row.status === "present") s.present++;
    else s.absent++;
  }

  const result = [...statsMap.entries()].map(([studentId, s]) => {
    const total = s.present + s.absent;
    return {
      studentId,
      presentDays: s.present,
      absentDays: s.absent,
      totalMarkedDays: total,
      percentage: total > 0 ? Math.round((s.present / total) * 100) : 0,
    };
  });

  res.json(result);
});

// GET /attendance/streaks - students with consecutive absences
router.get("/attendance/streaks", async (req, res) => {
  const minDays = parseInt((req.query.minDays as string) || "3", 10) || 3;
  const classIdFilter = req.query.classId ? parseInt(req.query.classId as string, 10) : null;
  const sectionIdFilter = req.query.sectionId ? parseInt(req.query.sectionId as string, 10) : null;

  const conditions: SQL[] = [eq(attendanceTable.status, "absent")];
  if (classIdFilter) conditions.push(eq(attendanceTable.classId, classIdFilter));
  if (sectionIdFilter) conditions.push(eq(attendanceTable.sectionId, sectionIdFilter));

  const rows = await db
    .select({
      studentId: attendanceTable.studentId,
      studentName: studentsTable.studentName,
      fatherName: studentsTable.fatherName,
      whatsappNumber: studentsTable.whatsappNumber,
      classId: attendanceTable.classId,
      className: classesTable.name,
      sectionId: attendanceTable.sectionId,
      sectionName: sectionsTable.name,
      date: attendanceTable.date,
    })
    .from(attendanceTable)
    .leftJoin(studentsTable, eq(attendanceTable.studentId, studentsTable.id))
    .leftJoin(classesTable, eq(attendanceTable.classId, classesTable.id))
    .leftJoin(sectionsTable, eq(attendanceTable.sectionId, sectionsTable.id))
    .where(and(...conditions))
    .orderBy(attendanceTable.studentId, attendanceTable.date);

  // Group by student and find consecutive absent streaks from most recent date
  const byStudent = new Map<number, typeof rows>();
  for (const row of rows) {
    if (!byStudent.has(row.studentId)) byStudent.set(row.studentId, []);
    byStudent.get(row.studentId)!.push(row);
  }

  const streaks: Array<{
    studentId: number; studentName: string; fatherName: string | null;
    whatsappNumber: string | null; classId: number; className: string | null;
    sectionId: number; sectionName: string | null;
    consecutiveDays: number; lastAbsenceDate: string; firstAbsenceDate: string;
  }> = [];

  for (const [, records] of byStudent) {
    // Sort descending by date to find the trailing streak
    const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));
    let streak = 1;
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1].date);
      const curr = new Date(sorted[i].date);
      const diffDays = Math.round((prev.getTime() - curr.getTime()) / 86400000);
      // Accept gaps of 1 (consecutive calendar days) or 3 (skip weekends)
      if (diffDays <= 3 && diffDays >= 1) {
        streak++;
      } else {
        break;
      }
    }
    if (streak >= minDays) {
      const first = sorted[streak - 1];
      const last = sorted[0];
      streaks.push({
        studentId: first.studentId,
        studentName: first.studentName ?? "",
        fatherName: first.fatherName ?? null,
        whatsappNumber: first.whatsappNumber ?? null,
        classId: first.classId,
        className: first.className ?? null,
        sectionId: first.sectionId,
        sectionName: first.sectionName ?? null,
        consecutiveDays: streak,
        lastAbsenceDate: last.date,
        firstAbsenceDate: first.date,
      });
    }
  }

  // Sort by streak length descending
  streaks.sort((a, b) => b.consecutiveDays - a.consecutiveDays);
  res.json(streaks);
});

// GET /attendance/live-status - all students with their attendance status for a date
router.get("/attendance/live-status", async (req, res) => {
  const today = new Date().toISOString().split("T")[0];
  const dateStr = (req.query.date as string) || today;

  const students = await db
    .select({
      studentId: studentsTable.id,
      studentName: studentsTable.studentName,
      fatherName: studentsTable.fatherName,
      uniqueId: studentsTable.uniqueId,
      rollNo: studentsTable.rollNo,
      classId: studentsTable.classId,
      className: classesTable.name,
      sectionId: studentsTable.sectionId,
      sectionName: sectionsTable.name,
      vehicleId: studentsTable.vehicleId,
      vehicleName: vehiclesTable.name,
    })
    .from(studentsTable)
    .leftJoin(classesTable, eq(studentsTable.classId, classesTable.id))
    .leftJoin(sectionsTable, eq(studentsTable.sectionId, sectionsTable.id))
    .leftJoin(vehiclesTable, eq(studentsTable.vehicleId, vehiclesTable.id))
    .orderBy(classesTable.name, sectionsTable.name, studentsTable.rollNo);

  const attRows = await db
    .select({
      studentId: attendanceTable.studentId,
      status: attendanceTable.status,
      scannedAt: attendanceTable.createdAt,
    })
    .from(attendanceTable)
    .where(eq(attendanceTable.date, dateStr));

  const attMap = new Map(attRows.map(r => [r.studentId, r]));

  const result = students.map(s => {
    const att = attMap.get(s.studentId);
    return {
      studentId: s.studentId,
      studentName: s.studentName,
      fatherName: s.fatherName,
      uniqueId: s.uniqueId,
      rollNo: s.rollNo,
      classId: s.classId,
      className: s.className,
      sectionId: s.sectionId,
      sectionName: s.sectionName,
      vehicleId: s.vehicleId ?? null,
      vehicleName: s.vehicleName ?? null,
      status: att ? att.status : "unmarked",
      scannedAt: att ? att.scannedAt.toISOString() : null,
    };
  });

  return res.json(result);
});

// GET /attendance/summary - summary by class/section for a date
router.get("/attendance/summary", async (req, res) => {
  const today = new Date().toISOString().split("T")[0];
  const dateStr = (req.query.date as string) || today;

  // Get all classes and sections from students
  const classSecPairs = await db
    .selectDistinct({
      classId: studentsTable.classId,
      className: classesTable.name,
      sectionId: studentsTable.sectionId,
      sectionName: sectionsTable.name,
    })
    .from(studentsTable)
    .leftJoin(classesTable, eq(studentsTable.classId, classesTable.id))
    .leftJoin(sectionsTable, eq(studentsTable.sectionId, sectionsTable.id));

  // Get total students per class/section
  const totalRows = await db
    .select({
      classId: studentsTable.classId,
      sectionId: studentsTable.sectionId,
    })
    .from(studentsTable);

  // Get attendance for the date
  const attRows = await db
    .select({
      studentId: attendanceTable.studentId,
      classId: attendanceTable.classId,
      sectionId: attendanceTable.sectionId,
      status: attendanceTable.status,
    })
    .from(attendanceTable)
    .where(eq(attendanceTable.date, dateStr));

  const summary = classSecPairs.map(pair => {
    const total = totalRows.filter(r => r.classId === pair.classId && r.sectionId === pair.sectionId).length;
    const attForPair = attRows.filter(r => r.classId === pair.classId && r.sectionId === pair.sectionId);
    const presentCount = attForPair.filter(r => r.status === "present").length;
    const absentCount = attForPair.filter(r => r.status === "absent").length;
    const unmarkedCount = total - presentCount - absentCount;

    return {
      classId: pair.classId,
      className: pair.className,
      sectionId: pair.sectionId,
      sectionName: pair.sectionName,
      totalStudents: total,
      presentCount,
      absentCount,
      unmarkedCount,
      date: dateStr,
    };
  });

  return res.json(summary);
});

// POST /attendance - save attendance records (requires admin or teacher auth)
router.post("/attendance", requireAuth("admin", "teacher"), async (req, res) => {
  const { date, records } = req.body;
  if (!date || !Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: "date and records are required" });
  }

  const studentIds = records.map((r: any) => r.studentId);

  // Get student info including parentEmail and vehicle/class for email
  const students = await db
    .select({
      id: studentsTable.id,
      classId: studentsTable.classId,
      sectionId: studentsTable.sectionId,
      studentName: studentsTable.studentName,
      fatherName: studentsTable.fatherName,
      parentEmail: studentsTable.parentEmail,
      whatsappNumber: studentsTable.whatsappNumber,
      vehicleId: studentsTable.vehicleId,
      vehicleName: vehiclesTable.name,
      className: classesTable.name,
      sectionName: sectionsTable.name,
    })
    .from(studentsTable)
    .leftJoin(vehiclesTable, eq(studentsTable.vehicleId, vehiclesTable.id))
    .leftJoin(classesTable, eq(studentsTable.classId, classesTable.id))
    .leftJoin(sectionsTable, eq(studentsTable.sectionId, sectionsTable.id))
    .where(inArray(studentsTable.id, studentIds));

  const studentMap = new Map(students.map(s => [s.id, s]));

  // Upsert: delete existing attendance for these students on this date, then insert
  if (studentIds.length > 0) {
    await db
      .delete(attendanceTable)
      .where(and(eq(attendanceTable.date, date), inArray(attendanceTable.studentId, studentIds)));
  }

  const toInsert = records
    .filter((r: any) => r.studentId && (r.status === "present" || r.status === "absent"))
    .map((r: any) => {
      const student = studentMap.get(r.studentId);
      return {
        studentId: r.studentId,
        date,
        status: r.status,
        classId: student?.classId ?? 0,
        sectionId: student?.sectionId ?? 0,
      };
    });

  if (toInsert.length > 0) {
    await db.insert(attendanceTable).values(toInsert);
  }

  // Send email notifications (fire-and-forget, don't block response)
  const time = new Date().toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" });
  const schoolSettings = await getSettings(["school_name", "school_address", "school_contact_number", "school_email"]).catch(() => ({} as Record<string, string>));
  for (const r of records) {
    const student = studentMap.get(r.studentId);
    if (student?.parentEmail) {
      sendAttendanceEmail({
        parentEmail: student.parentEmail,
        studentName: student.studentName,
        fatherName: student.fatherName,
        className: student.className ?? "",
        sectionName: student.sectionName ?? "",
        vehicleName: student.vehicleName ?? null,
        status: r.status as "present" | "absent",
        date,
        time,
        schoolName: schoolSettings["school_name"] || undefined,
        schoolAddress: schoolSettings["school_address"] || undefined,
        schoolPhone: schoolSettings["school_contact_number"] || undefined,
        schoolEmail: schoolSettings["school_email"] || undefined,
      }).catch((err) => req.log.warn({ err }, "Email notification failed"));
    }
  }

  return res.json({ saved: toInsert.length });
});

export default router;
