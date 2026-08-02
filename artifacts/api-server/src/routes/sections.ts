import { Router } from "express";
import { db, sectionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/sections", async (req, res) => {
  const { classId } = req.query;
  let sections;
  if (classId) {
    const cId = parseInt(classId as string, 10);
    if (!isNaN(cId)) {
      sections = await db.select().from(sectionsTable).where(eq(sectionsTable.classId, cId)).orderBy(sectionsTable.id);
    } else {
      sections = await db.select().from(sectionsTable).orderBy(sectionsTable.id);
    }
  } else {
    sections = await db.select().from(sectionsTable).orderBy(sectionsTable.id);
  }
  res.json(sections);
});

router.post("/sections", async (req, res) => {
  const { name, classId } = req.body;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({ error: "name is required" });
  }
  const [section] = await db.insert(sectionsTable).values({
    name: name.trim(),
    classId: classId ? parseInt(classId, 10) : null,
  }).returning();
  return res.status(201).json(section);
});

router.patch("/sections/:id", async (req, res) => {
  const id = parseInt(req.params['id'] as string, 10);
  if (isNaN(id)) return res.status(400).json({ error: "invalid id" });
  const { name, classId } = req.body;
  const updates: any = {};
  if (name) updates.name = name.trim();
  if (classId !== undefined) updates.classId = classId ? parseInt(classId, 10) : null;
  const [section] = await db.update(sectionsTable).set(updates).where(eq(sectionsTable.id, id)).returning();
  return res.json(section);
});

router.delete("/sections/:id", async (req, res) => {
  const id = parseInt(req.params['id'] as string, 10);
  if (isNaN(id)) return res.status(400).json({ error: "invalid id" });
  await db.delete(sectionsTable).where(eq(sectionsTable.id, id));
  return res.status(204).end();
});

export default router;
