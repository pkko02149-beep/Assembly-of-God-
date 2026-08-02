import { Router } from "express";
import { db, teacherMarkApprovalsTable, teachersTable, subjectsTable, examsTable, classesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth-middleware";
import { logger } from "../lib/logger";

const router = Router();

// GET /teacher-mark-approvals — admin sees all requests (optionally filtered)
router.get("/teacher-mark-approvals", requireAuth("admin"), async (req, res) => {
  const { examId, classId, status } = req.query as Record<string, string>;

  const rows = await db
    .select({
      id: teacherMarkApprovalsTable.id,
      teacherId: teacherMarkApprovalsTable.teacherId,
      teacherName: teachersTable.name,
      examId: teacherMarkApprovalsTable.examId,
      examName: examsTable.name,
      classId: teacherMarkApprovalsTable.classId,
      className: classesTable.name,
      subjectId: teacherMarkApprovalsTable.subjectId,
      subjectName: subjectsTable.name,
      status: teacherMarkApprovalsTable.status,
      validUntil: teacherMarkApprovalsTable.validUntil,
      adminNote: teacherMarkApprovalsTable.adminNote,
      requestedAt: teacherMarkApprovalsTable.requestedAt,
      reviewedAt: teacherMarkApprovalsTable.reviewedAt,
    })
    .from(teacherMarkApprovalsTable)
    .leftJoin(teachersTable, eq(teacherMarkApprovalsTable.teacherId, teachersTable.id))
    .leftJoin(examsTable, eq(teacherMarkApprovalsTable.examId, examsTable.id))
    .leftJoin(classesTable, eq(teacherMarkApprovalsTable.classId, classesTable.id))
    .leftJoin(subjectsTable, eq(teacherMarkApprovalsTable.subjectId, subjectsTable.id))
    .orderBy(desc(teacherMarkApprovalsTable.requestedAt));

  let result = rows;
  if (examId) result = result.filter(r => r.examId === parseInt(examId));
  if (classId) result = result.filter(r => r.classId === parseInt(classId));
  if (status) result = result.filter(r => r.status === status);

  return res.json(result);
});

// GET /teacher-mark-approvals/my — teacher sees their own requests
router.get("/teacher-mark-approvals/my", requireAuth("teacher"), async (req, res) => {
  const teacherId = req.user!.id;
  if (!teacherId) return res.status(403).json({ error: "No teacher profile" });

  const rows = await db
    .select({
      id: teacherMarkApprovalsTable.id,
      examId: teacherMarkApprovalsTable.examId,
      examName: examsTable.name,
      classId: teacherMarkApprovalsTable.classId,
      subjectId: teacherMarkApprovalsTable.subjectId,
      subjectName: subjectsTable.name,
      status: teacherMarkApprovalsTable.status,
      validUntil: teacherMarkApprovalsTable.validUntil,
      adminNote: teacherMarkApprovalsTable.adminNote,
      requestedAt: teacherMarkApprovalsTable.requestedAt,
      reviewedAt: teacherMarkApprovalsTable.reviewedAt,
    })
    .from(teacherMarkApprovalsTable)
    .leftJoin(examsTable, eq(teacherMarkApprovalsTable.examId, examsTable.id))
    .leftJoin(subjectsTable, eq(teacherMarkApprovalsTable.subjectId, subjectsTable.id))
    .where(eq(teacherMarkApprovalsTable.teacherId, teacherId))
    .orderBy(desc(teacherMarkApprovalsTable.requestedAt));

  return res.json(rows);
});

// POST /teacher-mark-approvals — teacher requests approval for a subject
router.post("/teacher-mark-approvals", requireAuth("teacher"), async (req, res) => {
  const teacherId = req.user!.id;
  if (!teacherId) return res.status(403).json({ error: "No teacher profile" });

  const { examId, classId, subjectId } = req.body as {
    examId?: number;
    classId?: number;
    subjectId?: number;
  };

  if (!examId || !classId || !subjectId) {
    return res.status(400).json({ error: "examId, classId, subjectId are required" });
  }

  // Check for existing pending request
  const existing = await db
    .select()
    .from(teacherMarkApprovalsTable)
    .where(
      and(
        eq(teacherMarkApprovalsTable.teacherId, teacherId),
        eq(teacherMarkApprovalsTable.examId, examId),
        eq(teacherMarkApprovalsTable.classId, classId),
        eq(teacherMarkApprovalsTable.subjectId, subjectId),
        eq(teacherMarkApprovalsTable.status, "pending"),
      ),
    );

  if (existing.length > 0) {
    return res.json({ ok: true, id: existing[0].id, alreadyPending: true });
  }

  const [created] = await db
    .insert(teacherMarkApprovalsTable)
    .values({ teacherId, examId, classId, subjectId, status: "pending" })
    .returning();

  logger.info({ teacherId, examId, classId, subjectId }, "Teacher mark approval requested");
  return res.json({ ok: true, id: created.id });
});

// PATCH /teacher-mark-approvals/:id — admin approves or rejects
router.patch("/teacher-mark-approvals/:id", requireAuth("admin"), async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  const { action, durationMinutes, adminNote } = req.body as {
    action?: "approved" | "rejected";
    durationMinutes?: number;
    adminNote?: string;
  };

  if (!action || !["approved", "rejected"].includes(action)) {
    return res.status(400).json({ error: "action must be 'approved' or 'rejected'" });
  }

  let validUntil: Date | null = null;
  if (action === "approved" && durationMinutes && durationMinutes > 0) {
    validUntil = new Date(Date.now() + durationMinutes * 60 * 1000);
  }

  const [updated] = await db
    .update(teacherMarkApprovalsTable)
    .set({
      status: action,
      validUntil: validUntil ?? undefined,
      adminNote: adminNote?.trim() ?? "",
      reviewedAt: new Date(),
    })
    .where(eq(teacherMarkApprovalsTable.id, id))
    .returning();

  if (!updated) return res.status(404).json({ error: "Request not found" });

  logger.info({ id, action }, "Teacher mark approval reviewed");
  return res.json({ ok: true, ...updated });
});

// GET /teacher-mark-approvals/check — teacher checks if they have approval for a subject
router.get("/teacher-mark-approvals/check", requireAuth("teacher"), async (req, res) => {
  const teacherId = req.user!.id;
  if (!teacherId) return res.status(403).json({ error: "No teacher profile" });

  const { examId, classId, subjectId } = req.query as Record<string, string>;

  const rows = await db
    .select()
    .from(teacherMarkApprovalsTable)
    .where(
      and(
        eq(teacherMarkApprovalsTable.teacherId, teacherId),
        eq(teacherMarkApprovalsTable.examId, parseInt(examId || "0")),
        eq(teacherMarkApprovalsTable.classId, parseInt(classId || "0")),
        eq(teacherMarkApprovalsTable.subjectId, parseInt(subjectId || "0")),
      ),
    )
    .orderBy(desc(teacherMarkApprovalsTable.requestedAt));

  const latest = rows[0];
  if (!latest) return res.json({ status: "none" });

  const isValid =
    latest.status === "approved" &&
    (!latest.validUntil || new Date(latest.validUntil) > new Date());

  return res.json({
    id: latest.id,
    status: latest.status,
    validUntil: latest.validUntil,
    isValid,
    adminNote: latest.adminNote,
  });
});

export default router;
