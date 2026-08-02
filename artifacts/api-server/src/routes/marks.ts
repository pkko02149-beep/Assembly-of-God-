import { Router } from "express";
import { db, studentMarksTable, studentsTable, classesTable, sectionsTable, teachersTable } from "@workspace/db";
import { eq, and, desc, SQL } from "drizzle-orm";
import { requireAuth } from "../lib/auth-middleware";

const router = Router();

// GET /marks
router.get("/marks", requireAuth("admin", "teacher", "parent"), async (req, res) => {
  const studentId = req.query.studentId as string | undefined;
  const classId = req.query.classId as string | undefined;
  const sectionId = req.query.sectionId as string | undefined;
  const examName = req.query.examName as string | undefined;
  const subject = req.query.subject as string | undefined;
  const teacherId = req.query.teacherId as string | undefined;

  const conditions: SQL<unknown>[] = [];
  if (studentId) conditions.push(eq(studentMarksTable.studentId, parseInt(studentId, 10)));
  if (classId) conditions.push(eq(studentMarksTable.classId, parseInt(classId, 10)));
  if (sectionId) conditions.push(eq(studentMarksTable.sectionId, parseInt(sectionId, 10)));
  if (examName) conditions.push(eq(studentMarksTable.examName, examName));
  if (subject) conditions.push(eq(studentMarksTable.subject, subject));
  if (teacherId) conditions.push(eq(studentMarksTable.teacherId, parseInt(teacherId, 10)));
  if (req.user!.role === "teacher") conditions.push(eq(studentMarksTable.teacherId, req.user!.id));

  const query = db
    .select({
      id: studentMarksTable.id,
      studentId: studentMarksTable.studentId,
      studentName: studentsTable.studentName,
      classId: studentMarksTable.classId,
      className: classesTable.name,
      sectionId: studentMarksTable.sectionId,
      sectionName: sectionsTable.name,
      subject: studentMarksTable.subject,
      examName: studentMarksTable.examName,
      marks: studentMarksTable.marks,
      maxMarks: studentMarksTable.maxMarks,
      examDate: studentMarksTable.examDate,
      teacherId: studentMarksTable.teacherId,
      teacherName: teachersTable.name,
      createdAt: studentMarksTable.createdAt,
    })
    .from(studentMarksTable)
    .leftJoin(studentsTable, eq(studentMarksTable.studentId, studentsTable.id))
    .leftJoin(classesTable, eq(studentMarksTable.classId, classesTable.id))
    .leftJoin(sectionsTable, eq(studentMarksTable.sectionId, sectionsTable.id))
    .leftJoin(teachersTable, eq(studentMarksTable.teacherId, teachersTable.id))
    .orderBy(desc(studentMarksTable.createdAt));

  const rows = conditions.length
    ? await query.where(conditions.length === 1 ? conditions[0] : and(...conditions))
    : await query;
  return res.json(rows);
});

// POST /marks
router.post("/marks", requireAuth("admin", "teacher"), async (req, res) => {
  const { studentId, subject, examName, marks, maxMarks, classId, sectionId, examDate } = req.body as {
    studentId?: number; subject?: string; examName?: string; marks?: string;
    maxMarks?: string; classId?: number; sectionId?: number; examDate?: string;
  };
  if (!studentId || !subject || !examName || marks === undefined || !classId) {
    return res.status(400).json({ error: "studentId, subject, examName, marks, classId are required" });
  }
  const teacherId = req.user!.role === "teacher" ? req.user!.id : (req.body.teacherId || req.user!.id);
  const rows = await db.insert(studentMarksTable).values({
    studentId, subject, examName, marks: marks.toString(),
    maxMarks: maxMarks?.toString() || "100", classId,
    sectionId: sectionId || null, examDate: examDate || null, teacherId,
  }).returning();
  return res.status(201).json(rows[0]);
});

// PUT /marks/:id
router.put("/marks/:id", requireAuth("admin", "teacher"), async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  const { marks, maxMarks, examDate } = req.body as { marks?: string; maxMarks?: string; examDate?: string };
  const update: Record<string, unknown> = {};
  if (marks !== undefined) update.marks = marks.toString();
  if (maxMarks !== undefined) update.maxMarks = maxMarks.toString();
  if (examDate) update.examDate = examDate;
  const rows = await db.update(studentMarksTable).set(update).where(eq(studentMarksTable.id, id)).returning();
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  return res.json(rows[0]);
});

// DELETE /marks/:id
router.delete("/marks/:id", requireAuth("admin", "teacher"), async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  await db.delete(studentMarksTable).where(eq(studentMarksTable.id, id));
  return res.json({ ok: true });
});

// GET /marks/report/student/:studentId — aggregated report
router.get("/marks/report/student/:studentId", requireAuth("admin", "teacher", "parent"), async (req, res) => {
  const studentId = parseInt(req.params.studentId as string, 10);
  const rows = await db
    .select({
      subject: studentMarksTable.subject,
      examName: studentMarksTable.examName,
      marks: studentMarksTable.marks,
      maxMarks: studentMarksTable.maxMarks,
      examDate: studentMarksTable.examDate,
    })
    .from(studentMarksTable)
    .where(eq(studentMarksTable.studentId, studentId))
    .orderBy(desc(studentMarksTable.createdAt));
  return res.json(rows);
});

export default router;
