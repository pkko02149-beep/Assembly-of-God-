import { Router } from "express";
import { db, examsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { notifyResultsPublished } from "../lib/push";

const router = Router();

// GET /exams?session=&status=
router.get("/exams", async (req, res) => {
  const rows = await db
    .select()
    .from(examsTable)
    .orderBy(desc(examsTable.createdAt));
  let result = rows;
  if (req.query.session) result = result.filter(r => r.session === req.query.session);
  if (req.query.status) result = result.filter(r => r.status === req.query.status);
  return res.json(result);
});

// GET /exams/:id
router.get("/exams/:id", async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  const rows = await db.select().from(examsTable).where(eq(examsTable.id, id));
  if (!rows[0]) return res.status(404).json({ error: "Exam not found" });
  return res.json(rows[0]);
});

// POST /exams
router.post("/exams", async (req, res) => {
  const { name, type, session, startDate, endDate, resultPublishDate, status, classes, passingPercentage } = req.body as {
    name?: string; type?: string; session?: string; startDate?: string; endDate?: string;
    resultPublishDate?: string; status?: string; classes?: number[]; passingPercentage?: string;
  };
  if (!name) return res.status(400).json({ error: "name is required" });
  const rows = await db.insert(examsTable).values({
    name, type: type || "unit_test", session: session || "",
    startDate: startDate || null, endDate: endDate || null,
    resultPublishDate: resultPublishDate || null,
    status: status || "draft",
    classes: JSON.stringify(classes || []),
    passingPercentage: passingPercentage?.toString() || "33",
  }).returning();
  return res.status(201).json(rows[0]);
});

// PUT /exams/:id
router.put("/exams/:id", async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  const allowed = ["name", "type", "session", "startDate", "endDate", "resultPublishDate", "status", "passingPercentage"];
  const update: Record<string, unknown> = {};
  for (const key of allowed) if (req.body[key] !== undefined) update[key] = req.body[key];
  if (req.body.classes !== undefined) update.classes = JSON.stringify(req.body.classes);
  const rows = await db.update(examsTable).set(update).where(eq(examsTable.id, id)).returning();
  if (!rows[0]) return res.status(404).json({ error: "Exam not found" });
  return res.json(rows[0]);
});

// DELETE /exams/:id
router.delete("/exams/:id", async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  await db.delete(examsTable).where(eq(examsTable.id, id));
  return res.json({ ok: true });
});

// POST /exams/:id/status — quick status change
router.post("/exams/:id/status", async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  const { status } = req.body as { status?: string };
  if (!status) return res.status(400).json({ error: "status is required" });
  const rows = await db.update(examsTable).set({ status }).where(eq(examsTable.id, id)).returning();
  if (!rows[0]) return res.status(404).json({ error: "Exam not found" });
  if (status === "published") {
    notifyResultsPublished({ examId: id, examName: rows[0].name }).catch(() => {});
  }
  return res.json(rows[0]);
});

export default router;
