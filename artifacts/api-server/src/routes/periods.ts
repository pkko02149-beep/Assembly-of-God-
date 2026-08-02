import { Router } from "express";
import { db, periodsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { requireAuth } from "../lib/auth-middleware";

const router = Router();

router.get("/periods", async (_req, res) => {
  const rows = await db.select().from(periodsTable).orderBy(asc(periodsTable.sortOrder), asc(periodsTable.id));
  return res.json(rows);
});

router.post("/periods", requireAuth("admin"), async (req, res) => {
  const { name, startTime, endTime, isBreak, sortOrder } = req.body as {
    name?: string; startTime?: string; endTime?: string; isBreak?: boolean; sortOrder?: number;
  };
  if (!name?.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const [row] = await db.insert(periodsTable).values({
    name: name.trim(),
    startTime: startTime || "",
    endTime: endTime || "",
    isBreak: isBreak ?? false,
    sortOrder: sortOrder ?? 0,
  }).returning();
  return res.status(201).json(row);
});

router.put("/periods/:id", requireAuth("admin"), async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  const { name, startTime, endTime, isBreak, sortOrder } = req.body as {
    name?: string; startTime?: string; endTime?: string; isBreak?: boolean; sortOrder?: number;
  };
  const update: Record<string, unknown> = {};
  if (name !== undefined) update.name = name;
  if (startTime !== undefined) update.startTime = startTime;
  if (endTime !== undefined) update.endTime = endTime;
  if (isBreak !== undefined) update.isBreak = isBreak;
  if (sortOrder !== undefined) update.sortOrder = sortOrder;
  const [row] = await db.update(periodsTable).set(update).where(eq(periodsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  return res.json(row);
});

router.delete("/periods/:id", requireAuth("admin"), async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  await db.delete(periodsTable).where(eq(periodsTable.id, id));
  return res.json({ ok: true });
});

export default router;
