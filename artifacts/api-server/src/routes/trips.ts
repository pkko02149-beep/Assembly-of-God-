import { Router } from "express";
import { db, tripsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/trips", async (req, res) => {
  const trips = await db.select().from(tripsTable).orderBy(tripsTable.id);
  res.json(trips);
});

router.post("/trips", async (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({ error: "name is required" });
  }
  const [trip] = await db.insert(tripsTable).values({ name: name.trim() }).returning();
  return res.status(201).json(trip);
});

router.patch("/trips/:id", async (req, res) => {
  const id = parseInt(req.params['id'] as string, 10);
  if (isNaN(id)) return res.status(400).json({ error: "invalid id" });
  const { name } = req.body;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({ error: "name is required" });
  }
  const [t] = await db.update(tripsTable).set({ name: name.trim() }).where(eq(tripsTable.id, id)).returning();
  return res.json(t);
});

router.delete("/trips/:id", async (req, res) => {
  const id = parseInt(req.params['id'] as string, 10);
  if (isNaN(id)) return res.status(400).json({ error: "invalid id" });
  await db.delete(tripsTable).where(eq(tripsTable.id, id));
  return res.status(204).end();
});

export default router;
