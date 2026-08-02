import { Router } from "express";
import { db, timetableTable, classesTable, sectionsTable, teachersTable, periodsTable, subjectsTable, teacherSubjectAssignmentsTable } from "@workspace/db";
import { eq, and, SQL, asc } from "drizzle-orm";
import { requireAuth } from "../lib/auth-middleware";

const router = Router();

// GET /timetable
router.get("/timetable", async (req, res) => {
  const classId = req.query.classId as string | undefined;
  const sectionId = req.query.sectionId as string | undefined;
  const teacherId = req.query.teacherId as string | undefined;
  const conditions: SQL<unknown>[] = [];
  if (classId) conditions.push(eq(timetableTable.classId, parseInt(classId, 10)));
  if (sectionId) conditions.push(eq(timetableTable.sectionId, parseInt(sectionId, 10)));
  if (teacherId) conditions.push(eq(timetableTable.teacherId, parseInt(teacherId, 10)));
  if ((req as any).user?.role === "teacher") conditions.push(eq(timetableTable.teacherId, (req as any).user.id));

  const base = db.select({
    id: timetableTable.id,
    classId: timetableTable.classId,
    className: classesTable.name,
    sectionId: timetableTable.sectionId,
    sectionName: sectionsTable.name,
    dayOfWeek: timetableTable.dayOfWeek,
    period: timetableTable.period,
    periodId: timetableTable.periodId,
    periodName: periodsTable.name,
    subject: timetableTable.subject,
    teacherId: timetableTable.teacherId,
    teacherName: teachersTable.name,
    startTime: timetableTable.startTime,
    endTime: timetableTable.endTime,
  }).from(timetableTable)
    .leftJoin(classesTable, eq(timetableTable.classId, classesTable.id))
    .leftJoin(sectionsTable, eq(timetableTable.sectionId, sectionsTable.id))
    .leftJoin(teachersTable, eq(timetableTable.teacherId, teachersTable.id))
    .leftJoin(periodsTable, eq(timetableTable.periodId, periodsTable.id))
    .orderBy(timetableTable.dayOfWeek, timetableTable.period);

  const rows = conditions.length
    ? await base.where(conditions.length === 1 ? conditions[0] : and(...conditions))
    : await base;

  return res.json(rows);
});

// POST /timetable/auto-generate
router.post("/timetable/auto-generate", requireAuth("admin"), async (req, res) => {
  const { classId, sectionId, replaceExisting } = req.body as {
    classId?: number; sectionId?: number; replaceExisting?: boolean;
  };
  if (!classId) { res.status(400).json({ error: "classId is required" }); return; }

  const subjects = await db.select().from(subjectsTable).where(eq(subjectsTable.classId, classId));
  if (subjects.length === 0) {
    res.status(400).json({ error: "No subjects found for this class. Add subjects first." });
    return;
  }

  const allPeriods = await db.select().from(periodsTable).orderBy(asc(periodsTable.sortOrder), asc(periodsTable.id));
  const activePeriods = allPeriods.filter(p => !p.isBreak);
  if (activePeriods.length === 0) {
    res.status(400).json({ error: "No periods defined. Add periods first." });
    return;
  }

  const assignments = await db.select().from(teacherSubjectAssignmentsTable)
    .where(eq(teacherSubjectAssignmentsTable.classId, classId));
  const allTeachers = await db.select().from(teachersTable);

  if (replaceExisting) {
    const conds: SQL<unknown>[] = [eq(timetableTable.classId, classId)];
    if (sectionId) conds.push(eq(timetableTable.sectionId, sectionId));
    await db.delete(timetableTable).where(conds.length === 1 ? conds[0] : and(...conds));
  }

  const existing = await db.select({
    teacherId: timetableTable.teacherId,
    dayOfWeek: timetableTable.dayOfWeek,
    periodId: timetableTable.periodId,
    period: timetableTable.period,
  }).from(timetableTable);

  const teacherBusy = new Set<string>();
  for (const e of existing) {
    teacherBusy.add(`${e.teacherId}-${e.dayOfWeek}-${e.periodId ?? e.period}`);
  }

  function findTeacher(subjectId: number, day: number, periodKey: number): number | null {
    const assign = assignments.find(a => a.subjectId === subjectId);
    const preferred = assign?.teacherId ?? null;
    const key = (tid: number) => `${tid}-${day}-${periodKey}`;
    if (preferred && !teacherBusy.has(key(preferred))) return preferred;
    const alt = allTeachers.find(t => !teacherBusy.has(key(t.id)));
    return alt?.id ?? allTeachers[0]?.id ?? null;
  }

  type TimetableInsert = typeof timetableTable.$inferInsert;
  const entries: TimetableInsert[] = [];
  const days = [1, 2, 3, 4, 5, 6];
  let subjectIndex = 0;

  for (const day of days) {
    for (const period of activePeriods) {
      const subj = subjects[subjectIndex % subjects.length];
      subjectIndex++;
      const teacherId = findTeacher(subj.id, day, period.id);
      if (!teacherId) continue;
      teacherBusy.add(`${teacherId}-${day}-${period.id}`);
      entries.push({
        classId,
        sectionId: sectionId ?? null,
        dayOfWeek: day,
        period: period.sortOrder > 0 ? period.sortOrder : period.id,
        periodId: period.id,
        subject: subj.name,
        teacherId,
        startTime: period.startTime,
        endTime: period.endTime,
      });
    }
  }

  if (entries.length > 0) {
    await db.insert(timetableTable).values(entries);
  }

  return res.json({ inserted: entries.length });
});

// POST /timetable
router.post("/timetable", requireAuth("admin"), async (req, res) => {
  const { classId, sectionId, dayOfWeek, period, periodId, subject, teacherId, startTime, endTime } = req.body as {
    classId?: number; sectionId?: number; dayOfWeek?: number; period?: number; periodId?: number;
    subject?: string; teacherId?: number; startTime?: string; endTime?: string;
  };
  if (!classId || !dayOfWeek || !period || !subject || !teacherId) {
    res.status(400).json({ error: "classId, dayOfWeek, period, subject, teacherId are required" });
    return;
  }
  if (periodId) {
    const conflict = await db.select({ id: timetableTable.id }).from(timetableTable)
      .where(and(
        eq(timetableTable.teacherId, teacherId),
        eq(timetableTable.dayOfWeek, dayOfWeek),
        eq(timetableTable.periodId, periodId),
      ));
    if (conflict.length > 0) {
      res.status(409).json({ error: "Teacher is already assigned to another class during this period." });
      return;
    }
  }
  const rows = await db.insert(timetableTable).values({
    classId, sectionId: sectionId ?? null, dayOfWeek, period, periodId: periodId ?? null,
    subject, teacherId, startTime: startTime ?? "", endTime: endTime ?? "",
  }).returning();
  return res.status(201).json(rows[0]);
});

// PUT /timetable/:id
router.put("/timetable/:id", requireAuth("admin"), async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  const { subject, teacherId, startTime, endTime, periodId, dayOfWeek, period } = req.body as {
    subject?: string; teacherId?: number; startTime?: string; endTime?: string;
    periodId?: number; dayOfWeek?: number; period?: number;
  };
  const update: Record<string, unknown> = {};
  if (subject !== undefined) update.subject = subject;
  if (teacherId !== undefined) update.teacherId = teacherId;
  if (startTime !== undefined) update.startTime = startTime;
  if (endTime !== undefined) update.endTime = endTime;
  if (periodId !== undefined) update.periodId = periodId;
  if (dayOfWeek !== undefined) update.dayOfWeek = dayOfWeek;
  if (period !== undefined) update.period = period;
  const rows = await db.update(timetableTable).set(update).where(eq(timetableTable.id, id)).returning();
  if (!rows[0]) { res.status(404).json({ error: "Not found" }); return; }
  return res.json(rows[0]);
});

// DELETE /timetable/:id
router.delete("/timetable/:id", requireAuth("admin"), async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  await db.delete(timetableTable).where(eq(timetableTable.id, id));
  return res.json({ ok: true });
});

export default router;
