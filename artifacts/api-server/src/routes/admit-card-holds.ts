import { Router } from "express";
import { db, admitCardHoldsTable, appSettingsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth-middleware";
import { logger } from "../lib/logger";

const router = Router();

// GET /admit-card-holds?examId= — get all holds for an exam
router.get("/admit-card-holds", requireAuth("admin", "parent"), async (req, res) => {
  const { examId, studentId } = req.query as Record<string, string>;
  if (!examId) return res.status(400).json({ error: "examId is required" });

  const conditions = [eq(admitCardHoldsTable.examId, parseInt(examId))];
  if (studentId) conditions.push(eq(admitCardHoldsTable.studentId, parseInt(studentId)));

  const rows = await db
    .select()
    .from(admitCardHoldsTable)
    .where(and(...conditions));

  return res.json(rows);
});

// POST /admit-card-holds/bulk — set hold status for multiple students
router.post("/admit-card-holds/bulk", requireAuth("admin"), async (req, res) => {
  const { examId, holds } = req.body as {
    examId?: number;
    holds?: Array<{ studentId: number; held: boolean }>;
  };

  if (!examId || !Array.isArray(holds)) {
    return res.status(400).json({ error: "examId and holds[] are required" });
  }

  for (const h of holds) {
    const existing = await db
      .select()
      .from(admitCardHoldsTable)
      .where(
        and(
          eq(admitCardHoldsTable.studentId, h.studentId),
          eq(admitCardHoldsTable.examId, examId),
        ),
      );

    if (existing.length > 0) {
      await db
        .update(admitCardHoldsTable)
        .set({ held: h.held, updatedAt: new Date() })
        .where(eq(admitCardHoldsTable.id, existing[0].id));
    } else if (h.held) {
      await db
        .insert(admitCardHoldsTable)
        .values({ studentId: h.studentId, examId, held: true });
    }
  }

  logger.info({ examId, count: holds.length }, "Admit card holds updated");
  return res.json({ ok: true });
});

// GET /admit-card-holds/publish-status?examId= — check if admit cards are published for an exam
router.get("/admit-card-holds/publish-status", async (req, res) => {
  const { examId } = req.query as Record<string, string>;
  if (!examId) return res.status(400).json({ error: "examId is required" });
  const key = `admit_cards_published_${examId}`;
  const rows = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, key));
  return res.json({ published: rows[0]?.value === "true" });
});

// POST /admit-card-holds/publish — admin publishes admit cards for an exam
router.post("/admit-card-holds/publish", requireAuth("admin"), async (req, res) => {
  const { examId, published } = req.body as { examId?: number; published?: boolean };
  if (!examId) return res.status(400).json({ error: "examId is required" });
  const key = `admit_cards_published_${examId}`;
  const value = published !== false ? "true" : "false";
  const existing = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, key));
  if (existing.length > 0) {
    await db.update(appSettingsTable).set({ value, updatedAt: new Date() }).where(eq(appSettingsTable.key, key));
  } else {
    await db.insert(appSettingsTable).values({ key, value });
  }
  logger.info({ examId, published: value }, "Admit card publish status updated");
  return res.json({ ok: true, published: value === "true" });
});

export default router;
