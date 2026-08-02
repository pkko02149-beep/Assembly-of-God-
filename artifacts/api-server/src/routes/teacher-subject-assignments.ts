import { Router } from "express";
import { db, teacherSubjectAssignmentsTable, subjectsTable, classesTable, sectionsTable, teachersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

// GET /teacher-subject-assignments?teacherId=&classId=&session=
router.get("/teacher-subject-assignments", async (req, res) => {
  const { teacherId, classId, session } = req.query as Record<string, string>;
  const conditions = [];
  if (teacherId) conditions.push(eq(teacherSubjectAssignmentsTable.teacherId, parseInt(teacherId, 10)));
  if (classId) conditions.push(eq(teacherSubjectAssignmentsTable.classId, parseInt(classId, 10)));
  if (session) conditions.push(eq(teacherSubjectAssignmentsTable.session, session));

  const base = db
    .select({
      id: teacherSubjectAssignmentsTable.id,
      teacherId: teacherSubjectAssignmentsTable.teacherId,
      teacherName: teachersTable.name,
      subjectId: teacherSubjectAssignmentsTable.subjectId,
      subjectName: subjectsTable.name,
      subjectCode: subjectsTable.code,
      classId: teacherSubjectAssignmentsTable.classId,
      className: classesTable.name,
      sectionId: teacherSubjectAssignmentsTable.sectionId,
      sectionName: sectionsTable.name,
      session: teacherSubjectAssignmentsTable.session,
      createdAt: teacherSubjectAssignmentsTable.createdAt,
    })
    .from(teacherSubjectAssignmentsTable)
    .leftJoin(teachersTable, eq(teacherSubjectAssignmentsTable.teacherId, teachersTable.id))
    .leftJoin(subjectsTable, eq(teacherSubjectAssignmentsTable.subjectId, subjectsTable.id))
    .leftJoin(classesTable, eq(teacherSubjectAssignmentsTable.classId, classesTable.id))
    .leftJoin(sectionsTable, eq(teacherSubjectAssignmentsTable.sectionId, sectionsTable.id));

  const rows = conditions.length
    ? await base.where(conditions.length === 1 ? conditions[0] : and(...conditions))
    : await base;
  return res.json(rows);
});

// POST /teacher-subject-assignments
router.post("/teacher-subject-assignments", async (req, res) => {
  const { teacherId, subjectId, classId, sectionId, session } = req.body as {
    teacherId?: number; subjectId?: number; classId?: number; sectionId?: number; session?: string;
  };
  if (!teacherId || !subjectId || !classId) return res.status(400).json({ error: "teacherId, subjectId, classId are required" });
  const rows = await db.insert(teacherSubjectAssignmentsTable).values({
    teacherId, subjectId, classId, sectionId: sectionId || null, session: session || "",
  }).returning();
  return res.status(201).json(rows[0]);
});

// DELETE /teacher-subject-assignments/:id
router.delete("/teacher-subject-assignments/:id", async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  await db.delete(teacherSubjectAssignmentsTable).where(eq(teacherSubjectAssignmentsTable.id, id));
  return res.json({ ok: true });
});

export default router;
