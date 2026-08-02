import { Router } from "express";
import { db, noticesTable, teachersTable } from "@workspace/db";
import { eq, and, desc, SQL } from "drizzle-orm";
import { verifyToken } from "../lib/jwt";
import { logger } from "../lib/logger";

const router = Router();

// GET /notices — all roles can read
router.get("/notices", async (req, res) => {
  const targetRole = req.query.targetRole as string | undefined;
  const classId = req.query.classId as string | undefined;
  const sectionId = req.query.sectionId as string | undefined;
  const isActive = req.query.isActive as string | undefined;
  const conditions: SQL<unknown>[] = [];
  if (targetRole) conditions.push(eq(noticesTable.targetRole, targetRole));
  if (classId) conditions.push(eq(noticesTable.classId, parseInt(classId, 10)));
  if (sectionId) conditions.push(eq(noticesTable.sectionId, parseInt(sectionId, 10)));
  if (isActive !== undefined) conditions.push(eq(noticesTable.isActive, isActive === "true"));

  const rows = await db.select({
    id: noticesTable.id,
    title: noticesTable.title,
    content: noticesTable.content,
    targetRole: noticesTable.targetRole,
    classId: noticesTable.classId,
    sectionId: noticesTable.sectionId,
    authorRole: noticesTable.authorRole,
    authorId: noticesTable.authorId,
    teacherName: teachersTable.name,
    isActive: noticesTable.isActive,
    createdAt: noticesTable.createdAt,
  }).from(noticesTable)
    .leftJoin(teachersTable, eq(noticesTable.authorId, teachersTable.id))
    .where(conditions.length ? (conditions.length === 1 ? conditions[0] : and(...conditions)) : undefined)
    .orderBy(desc(noticesTable.createdAt));

  return res.json(rows);
});

// POST /notices — admin (no JWT) or teacher (JWT)
router.post("/notices", async (req, res) => {
  const { title, content, targetRole, classId, sectionId } = req.body as {
    title?: string; content?: string; targetRole?: string; classId?: number; sectionId?: number;
  };
  if (!title || !content) return res.status(400).json({ error: "title and content are required" });

  // Detect if this is a teacher posting (JWT present)
  let authorRole = "admin";
  let authorId: number | null = null;
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    try {
      const payload = verifyToken(auth.slice(7));
      if (payload.role === "teacher") {
        authorRole = "teacher";
        authorId = payload.id;
      }
    } catch { /* not a teacher */ }
  }

  const rows = await db.insert(noticesTable).values({
    title, content,
    targetRole: targetRole || "all",
    classId: classId || null,
    sectionId: sectionId || null,
    authorRole,
    authorId,
    isActive: true,
  }).returning();
  logger.info({ noticeId: rows[0].id, authorRole }, "Notice created");
  return res.status(201).json(rows[0]);
});

// PUT /notices/:id
router.put("/notices/:id", async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  const { title, content, targetRole, isActive, classId, sectionId } = req.body as {
    title?: string; content?: string; targetRole?: string; isActive?: boolean;
    classId?: number | null; sectionId?: number | null;
  };
  const update: Record<string, unknown> = {};
  if (title) update.title = title;
  if (content) update.content = content;
  if (targetRole) update.targetRole = targetRole;
  if (isActive !== undefined) update.isActive = isActive;
  if (classId !== undefined) update.classId = classId;
  if (sectionId !== undefined) update.sectionId = sectionId;
  const rows = await db.update(noticesTable).set(update).where(eq(noticesTable.id, id)).returning();
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  return res.json(rows[0]);
});

// DELETE /notices/:id
router.delete("/notices/:id", async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  await db.delete(noticesTable).where(eq(noticesTable.id, id));
  return res.json({ ok: true });
});

export default router;
