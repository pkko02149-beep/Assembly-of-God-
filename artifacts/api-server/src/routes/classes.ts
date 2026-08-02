import { Router } from "express";
import { db, classesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/classes", async (req, res) => {
  const classes = await db.select().from(classesTable).orderBy(classesTable.id);
  res.json(classes);
});

router.post("/classes", async (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({ error: "name is required" });
  }
  const [cls] = await db.insert(classesTable).values({ name: name.trim() }).returning();
  return res.status(201).json(cls);
});

router.patch("/classes/:id", async (req, res) => {
  const id = parseInt(req.params['id'] as string, 10);
  if (isNaN(id)) return res.status(400).json({ error: "invalid id" });
  const { name } = req.body;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({ error: "name is required" });
  }
  const [cls] = await db.update(classesTable).set({ name: name.trim() }).where(eq(classesTable.id, id)).returning();
  return res.json(cls);
});

router.delete("/classes/:id", async (req, res) => {
  const id = parseInt(req.params['id'] as string, 10);
  if (isNaN(id)) return res.status(400).json({ error: "invalid id" });
  await db.delete(classesTable).where(eq(classesTable.id, id));
  return res.status(204).end();
});

export default router;
