import { Router } from "express";
import { db, vehiclesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/vehicles", async (req, res) => {
  const vehicles = await db.select().from(vehiclesTable).orderBy(vehiclesTable.id);
  res.json(vehicles);
});

router.post("/vehicles", async (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({ error: "name is required" });
  }
  const [vehicle] = await db.insert(vehiclesTable).values({ name: name.trim() }).returning();
  return res.status(201).json(vehicle);
});

router.patch("/vehicles/:id", async (req, res) => {
  const id = parseInt(req.params['id'] as string, 10);
  if (isNaN(id)) return res.status(400).json({ error: "invalid id" });
  const { name } = req.body;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({ error: "name is required" });
  }
  const [v] = await db.update(vehiclesTable).set({ name: name.trim() }).where(eq(vehiclesTable.id, id)).returning();
  return res.json(v);
});

router.delete("/vehicles/:id", async (req, res) => {
  const id = parseInt(req.params['id'] as string, 10);
  if (isNaN(id)) return res.status(400).json({ error: "invalid id" });
  await db.delete(vehiclesTable).where(eq(vehiclesTable.id, id));
  return res.status(204).end();
});

export default router;
