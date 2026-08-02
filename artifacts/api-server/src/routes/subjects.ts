import { Router } from "express";
import { db, subjectsTable, classesTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

const router = Router();

// GET /subjects?classId=
router.get("/subjects", async (req, res) => {
  const classId = req.query.classId as string | undefined;
  const base = db
    .select({
      id: subjectsTable.id,
      name: subjectsTable.name,
      code: subjectsTable.code,
      classId: subjectsTable.classId,
      className: classesTable.name,
      maxTheoryMarks: subjectsTable.maxTheoryMarks,
      maxPracticalMarks: subjectsTable.maxPracticalMarks,
      maxInternalMarks: subjectsTable.maxInternalMarks,
      isOptional: subjectsTable.isOptional,
      orderIndex: subjectsTable.orderIndex,
      createdAt: subjectsTable.createdAt,
    })
    .from(subjectsTable)
    .leftJoin(classesTable, eq(subjectsTable.classId, classesTable.id))
    .orderBy(asc(subjectsTable.orderIndex), asc(subjectsTable.name));
  const rows = classId
    ? await base.where(eq(subjectsTable.classId, parseInt(classId, 10)))
    : await base;
  return res.json(rows);
});

// POST /subjects
router.post("/subjects", async (req, res) => {
  const { name, code, classId, maxTheoryMarks, maxPracticalMarks, maxInternalMarks, isOptional, orderIndex } = req.body as {
    name?: string; code?: string; classId?: number;
    maxTheoryMarks?: string; maxPracticalMarks?: string; maxInternalMarks?: string;
    isOptional?: boolean; orderIndex?: number;
  };
  if (!name || !classId) return res.status(400).json({ error: "name and classId are required" });
  const rows = await db.insert(subjectsTable).values({
    name, code: code || "", classId,
    maxTheoryMarks: maxTheoryMarks?.toString() || "100",
    maxPracticalMarks: maxPracticalMarks?.toString() || "0",
    maxInternalMarks: maxInternalMarks?.toString() || "0",
    isOptional: isOptional ?? false,
    orderIndex: orderIndex ?? 0,
  }).returning();
  return res.status(201).json(rows[0]);
});

// PUT /subjects/:id
router.put("/subjects/:id", async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  const allowed = ["name", "code", "classId", "maxTheoryMarks", "maxPracticalMarks", "maxInternalMarks", "isOptional", "orderIndex"];
  const update: Record<string, unknown> = {};
  for (const key of allowed) if (req.body[key] !== undefined) update[key] = req.body[key];
  const rows = await db.update(subjectsTable).set(update).where(eq(subjectsTable.id, id)).returning();
  if (!rows[0]) return res.status(404).json({ error: "Subject not found" });
  return res.json(rows[0]);
});

// DELETE /subjects/:id
router.delete("/subjects/:id", async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  await db.delete(subjectsTable).where(eq(subjectsTable.id, id));
  return res.json({ ok: true });
});

export default router;
