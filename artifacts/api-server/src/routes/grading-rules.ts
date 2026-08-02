import { Router } from "express";
import { db, gradingRulesTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

const router = Router();

// Default grading rules to seed
const DEFAULT_RULES = [
  { minPercent: "91", maxPercent: "100", grade: "A1", gradePoint: "10.0", description: "Outstanding" },
  { minPercent: "81", maxPercent: "90", grade: "A2", gradePoint: "9.0", description: "Excellent" },
  { minPercent: "71", maxPercent: "80", grade: "B1", gradePoint: "8.0", description: "Very Good" },
  { minPercent: "61", maxPercent: "70", grade: "B2", gradePoint: "7.0", description: "Good" },
  { minPercent: "51", maxPercent: "60", grade: "C1", gradePoint: "6.0", description: "Above Average" },
  { minPercent: "41", maxPercent: "50", grade: "C2", gradePoint: "5.0", description: "Average" },
  { minPercent: "33", maxPercent: "40", grade: "D", gradePoint: "4.0", description: "Pass" },
  { minPercent: "0", maxPercent: "32", grade: "E", gradePoint: "0.0", description: "Fail" },
];

// GET /grading-rules
router.get("/grading-rules", async (_req, res) => {
  let rows = await db.select().from(gradingRulesTable).orderBy(asc(gradingRulesTable.minPercent));
  // Seed defaults if empty
  if (rows.length === 0) {
    const inserted = await db.insert(gradingRulesTable).values(DEFAULT_RULES).returning();
    rows = inserted;
  }
  return res.json(rows);
});

// POST /grading-rules
router.post("/grading-rules", async (req, res) => {
  const { minPercent, maxPercent, grade, gradePoint, description } = req.body as {
    minPercent?: string; maxPercent?: string; grade?: string; gradePoint?: string; description?: string;
  };
  if (minPercent === undefined || maxPercent === undefined || !grade) {
    return res.status(400).json({ error: "minPercent, maxPercent, grade are required" });
  }
  const rows = await db.insert(gradingRulesTable).values({
    minPercent: minPercent.toString(), maxPercent: maxPercent.toString(),
    grade, gradePoint: gradePoint?.toString() || "0", description: description || "",
  }).returning();
  return res.status(201).json(rows[0]);
});

// PUT /grading-rules/:id
router.put("/grading-rules/:id", async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  const allowed = ["minPercent", "maxPercent", "grade", "gradePoint", "description"];
  const update: Record<string, unknown> = {};
  for (const key of allowed) if (req.body[key] !== undefined) update[key] = req.body[key].toString();
  const rows = await db.update(gradingRulesTable).set(update).where(eq(gradingRulesTable.id, id)).returning();
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  return res.json(rows[0]);
});

// DELETE /grading-rules/:id
router.delete("/grading-rules/:id", async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  await db.delete(gradingRulesTable).where(eq(gradingRulesTable.id, id));
  return res.json({ ok: true });
});

// POST /grading-rules/reset — reset to defaults
router.post("/grading-rules/reset", async (_req, res) => {
  await db.delete(gradingRulesTable);
  const rows = await db.insert(gradingRulesTable).values(DEFAULT_RULES).returning();
  return res.json(rows);
});

export default router;
