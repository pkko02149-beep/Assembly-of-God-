import { Router } from "express";
import { db, firRecordsTable, studentsTable, teachersTable, classesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

// GET /fir — list FIR records (filter by classId or studentId)
router.get("/fir", async (req, res) => {
  const { classId, studentId } = req.query as Record<string, string>;

  const rows = await db
    .select({
      id: firRecordsTable.id,
      studentId: firRecordsTable.studentId,
      classId: firRecordsTable.classId,
      incidentDate: firRecordsTable.incidentDate,
      description: firRecordsTable.description,
      actionTaken: firRecordsTable.actionTaken,
      severity: firRecordsTable.severity,
      status: firRecordsTable.status,
      resolvedAt: firRecordsTable.resolvedAt,
      reportedById: firRecordsTable.reportedById,
      createdAt: firRecordsTable.createdAt,
      studentName: studentsTable.studentName,
      fatherName: studentsTable.fatherName,
      className: classesTable.name,
      teacherName: teachersTable.name,
    })
    .from(firRecordsTable)
    .leftJoin(studentsTable, eq(firRecordsTable.studentId, studentsTable.id))
    .leftJoin(classesTable, eq(firRecordsTable.classId, classesTable.id))
    .leftJoin(teachersTable, eq(firRecordsTable.reportedById, teachersTable.id))
    .orderBy(firRecordsTable.incidentDate);

  let result = rows;
  if (classId) result = result.filter(r => r.classId === parseInt(classId));
  if (studentId) result = result.filter(r => r.studentId === parseInt(studentId));

  return res.json(result.reverse());
});

// POST /fir — create a new FIR record
router.post("/fir", async (req, res) => {
  const { studentId, classId, incidentDate, description, actionTaken, severity, reportedById } = req.body as {
    studentId?: number; classId?: number; incidentDate?: string;
    description?: string; actionTaken?: string; severity?: string; reportedById?: number;
  };

  if (!studentId || !classId || !incidentDate || !description || !reportedById) {
    return res.status(400).json({ error: "studentId, classId, incidentDate, description, and reportedById are required" });
  }

  const [record] = await db.insert(firRecordsTable).values({
    studentId, classId, incidentDate, description,
    actionTaken: actionTaken || "",
    severity: severity || "minor",
    status: "open",
    reportedById,
  }).returning();

  logger.info({ firId: record.id, studentId }, "FIR record created");
  return res.status(201).json(record);
});

// PUT /fir/:id — update FIR record (status, actionTaken, resolvedAt)
router.put("/fir/:id", async (req, res) => {
  const id = parseInt(req.params['id'] as string);
  const { actionTaken, status, description, severity, resolvedAt } = req.body as {
    actionTaken?: string; status?: string; description?: string; severity?: string; resolvedAt?: string | null;
  };

  const updates: Partial<typeof firRecordsTable.$inferInsert> = {};
  if (actionTaken !== undefined) updates.actionTaken = actionTaken;
  if (description !== undefined) updates.description = description;
  if (severity !== undefined) updates.severity = severity;
  if (status !== undefined) {
    updates.status = status;
    // Auto-set resolvedAt when resolving if not explicitly provided
    if (status === "resolved" && resolvedAt === undefined) {
      updates.resolvedAt = new Date().toISOString().split("T")[0];
    }
    // Clear resolvedAt when reopening
    if (status === "open") {
      updates.resolvedAt = null;
    }
  }
  // Explicit resolvedAt always wins
  if (resolvedAt !== undefined) updates.resolvedAt = resolvedAt;

  if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No fields to update" });

  const [record] = await db.update(firRecordsTable).set(updates).where(eq(firRecordsTable.id, id)).returning();
  if (!record) return res.status(404).json({ error: "FIR record not found" });

  logger.info({ firId: id }, "FIR record updated");
  return res.json(record);
});

// DELETE /fir/:id
router.delete("/fir/:id", async (req, res) => {
  const id = parseInt(req.params['id'] as string);
  await db.delete(firRecordsTable).where(eq(firRecordsTable.id, id));
  logger.info({ firId: id }, "FIR record deleted");
  return res.json({ ok: true });
});

export default router;
