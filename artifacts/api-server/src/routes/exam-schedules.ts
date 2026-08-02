import { Router } from "express";
import { db, examSchedulesTable, subjectsTable, classesTable, examsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

// GET /exam-schedules?examId=&classId=
router.get("/exam-schedules", async (req, res) => {
  const { examId, classId } = req.query as Record<string, string>;
  const conditions = [];
  if (examId) conditions.push(eq(examSchedulesTable.examId, parseInt(examId, 10)));
  if (classId) conditions.push(eq(examSchedulesTable.classId, parseInt(classId, 10)));

  const base = db
    .select({
      id: examSchedulesTable.id,
      examId: examSchedulesTable.examId,
      examName: examsTable.name,
      subjectId: examSchedulesTable.subjectId,
      subjectName: subjectsTable.name,
      subjectCode: subjectsTable.code,
      classId: examSchedulesTable.classId,
      className: classesTable.name,
      examDate: examSchedulesTable.examDate,
      startTime: examSchedulesTable.startTime,
      endTime: examSchedulesTable.endTime,
      room: examSchedulesTable.room,
      invigilator: examSchedulesTable.invigilator,
      createdAt: examSchedulesTable.createdAt,
    })
    .from(examSchedulesTable)
    .leftJoin(subjectsTable, eq(examSchedulesTable.subjectId, subjectsTable.id))
    .leftJoin(classesTable, eq(examSchedulesTable.classId, classesTable.id))
    .leftJoin(examsTable, eq(examSchedulesTable.examId, examsTable.id));

  const rows = conditions.length
    ? await base.where(conditions.length === 1 ? conditions[0] : and(...conditions))
    : await base;
  return res.json(rows);
});

// POST /exam-schedules
router.post("/exam-schedules", async (req, res) => {
  const { examId, subjectId, classId, examDate, startTime, endTime, room, invigilator } = req.body as {
    examId?: number; subjectId?: number; classId?: number;
    examDate?: string; startTime?: string; endTime?: string; room?: string; invigilator?: string;
  };
  if (!examId || !subjectId || !classId) return res.status(400).json({ error: "examId, subjectId, classId are required" });
  const rows = await db.insert(examSchedulesTable).values({
    examId, subjectId, classId,
    examDate: examDate || null, startTime: startTime || "", endTime: endTime || "",
    room: room || "", invigilator: invigilator || "",
  }).returning();
  return res.status(201).json(rows[0]);
});

// PUT /exam-schedules/:id
router.put("/exam-schedules/:id", async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  const allowed = ["examDate", "startTime", "endTime", "room", "invigilator"];
  const update: Record<string, unknown> = {};
  for (const key of allowed) if (req.body[key] !== undefined) update[key] = req.body[key];
  const rows = await db.update(examSchedulesTable).set(update).where(eq(examSchedulesTable.id, id)).returning();
  if (!rows[0]) return res.status(404).json({ error: "Schedule not found" });
  return res.json(rows[0]);
});

// DELETE /exam-schedules/:id
router.delete("/exam-schedules/:id", async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  await db.delete(examSchedulesTable).where(eq(examSchedulesTable.id, id));
  return res.json({ ok: true });
});

export default router;
