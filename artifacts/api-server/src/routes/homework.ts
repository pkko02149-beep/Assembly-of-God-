import { Router } from "express";
import { db, pool, homeworkTable, classesTable, sectionsTable, teachersTable } from "@workspace/db";
import { eq, and, desc, gte, lte, SQL } from "drizzle-orm";
import { requireAuth } from "../lib/auth-middleware";
import { notifyHomeworkAssigned } from "../lib/push";
import { getCurrentSchemaName } from "../lib/session-context";

const router = Router();

// GET /homework/public — no auth required; used by the public homework page
router.get("/homework/public", async (req, res) => {
  const classId = req.query.classId as string | undefined;
  const sectionId = req.query.sectionId as string | undefined;
  const subject = req.query.subject as string | undefined;
  const dueDate = req.query.dueDate as string | undefined;

  if (!classId) return res.status(400).json({ error: "classId is required" });

  let query = db
    .select({
      id: homeworkTable.id,
      classId: homeworkTable.classId,
      className: classesTable.name,
      sectionId: homeworkTable.sectionId,
      sectionName: sectionsTable.name,
      subject: homeworkTable.subject,
      title: homeworkTable.title,
      description: homeworkTable.description,
      titleHi: homeworkTable.titleHi,
      descriptionHi: homeworkTable.descriptionHi,
      dueDate: homeworkTable.dueDate,
      teacherId: homeworkTable.teacherId,
      teacherName: teachersTable.name,
      createdAt: homeworkTable.createdAt,
    })
    .from(homeworkTable)
    .leftJoin(classesTable, eq(homeworkTable.classId, classesTable.id))
    .leftJoin(sectionsTable, eq(homeworkTable.sectionId, sectionsTable.id))
    .leftJoin(teachersTable, eq(homeworkTable.teacherId, teachersTable.id))
    .orderBy(desc(homeworkTable.dueDate));

  const conditions: SQL<unknown>[] = [];
  conditions.push(eq(homeworkTable.classId, parseInt(classId, 10)));
  if (sectionId) conditions.push(eq(homeworkTable.sectionId, parseInt(sectionId, 10)));
  if (subject) conditions.push(eq(homeworkTable.subject, subject));
  // Show homework due on or after the selected date so that today's date
  // reveals homework assigned today but due tomorrow (the common case).
  if (dueDate) conditions.push(gte(homeworkTable.dueDate, dueDate));

  const rows = await query.where(and(...conditions));

  return res.json(rows);
});

// GET /website/classes — public list of classes
router.get("/website/classes", async (_req, res) => {
  const classes = await db.select().from(classesTable).orderBy(classesTable.id);
  return res.json(classes);
});

// GET /website/sections?classId= — public list of sections
router.get("/website/sections", async (req, res) => {
  const classId = req.query.classId as string | undefined;
  let query = db.select().from(sectionsTable).orderBy(sectionsTable.id);
  if (classId) {
    const rows = await db.select().from(sectionsTable)
      .where(eq(sectionsTable.classId, parseInt(classId, 10)))
      .orderBy(sectionsTable.id);
    return res.json(rows);
  }
  return res.json(await query);
});

// GET /homework
router.get("/homework", requireAuth("admin", "teacher", "parent"), async (req, res) => {
  const classId = req.query.classId as string | undefined;
  const sectionId = req.query.sectionId as string | undefined;
  const teacherId = req.query.teacherId as string | undefined;
  // ?date=YYYY-MM-DD  → filter by createdAt date (day homework was assigned)
  const date = req.query.date as string | undefined;

  let query = db
    .select({
      id: homeworkTable.id,
      classId: homeworkTable.classId,
      className: classesTable.name,
      sectionId: homeworkTable.sectionId,
      sectionName: sectionsTable.name,
      subject: homeworkTable.subject,
      title: homeworkTable.title,
      description: homeworkTable.description,
      titleHi: homeworkTable.titleHi,
      descriptionHi: homeworkTable.descriptionHi,
      dueDate: homeworkTable.dueDate,
      teacherId: homeworkTable.teacherId,
      teacherName: teachersTable.name,
      createdAt: homeworkTable.createdAt,
    })
    .from(homeworkTable)
    .leftJoin(classesTable, eq(homeworkTable.classId, classesTable.id))
    .leftJoin(sectionsTable, eq(homeworkTable.sectionId, sectionsTable.id))
    .leftJoin(teachersTable, eq(homeworkTable.teacherId, teachersTable.id))
    .orderBy(desc(homeworkTable.createdAt));

  const conditions: SQL<unknown>[] = [];
  if (classId) conditions.push(eq(homeworkTable.classId, parseInt(classId, 10)));
  if (sectionId) conditions.push(eq(homeworkTable.sectionId, parseInt(sectionId, 10)));
  if (teacherId) conditions.push(eq(homeworkTable.teacherId, parseInt(teacherId, 10)));

  // Filter by assigned date (createdAt range covering the full day)
  if (date) {
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);
    conditions.push(gte(homeworkTable.createdAt, dayStart));
    conditions.push(lte(homeworkTable.createdAt, dayEnd));
  }

  // Teacher sees only their own homework
  if (req.user!.role === "teacher") {
    conditions.push(eq(homeworkTable.teacherId, req.user!.id));
  }

  const rows = conditions.length
    ? await query.where(conditions.length === 1 ? conditions[0] : and(...conditions))
    : await query;
  return res.json(rows);
});

// POST /homework
router.post("/homework", requireAuth("admin", "teacher"), async (req, res) => {
  try {
    const { classId, sectionId, subject, title, description, titleHi, descriptionHi, dueDate } = req.body as {
      classId?: number; sectionId?: number; subject?: string;
      title?: string; description?: string; titleHi?: string; descriptionHi?: string; dueDate?: string;
    };
    if (!classId || !subject || !title || !dueDate) {
      return res.status(400).json({ error: "classId, subject, title, dueDate are required" });
    }
    const teacherId = req.user!.role === "teacher" ? req.user!.id : (req.body.teacherId || req.user!.id);

    let rows: any[];
    try {
      // Try with Hindi fields first (works once columns exist in DB)
      rows = await db.insert(homeworkTable).values({
        classId, sectionId: sectionId || null, subject, title,
        description: description || "",
        titleHi: titleHi || "",
        descriptionHi: descriptionHi || "",
        dueDate, teacherId,
      }).returning();
    } catch (dbErr: any) {
      const msg: string = dbErr?.message || "";
      // If Hindi columns don't exist yet in this DB, fall back to insert without them
      if (msg.includes("title_hi") || msg.includes("description_hi")) {
        // Fall back to raw SQL without Hindi columns.
        // Must honour the session schema (same one the session middleware set) so
        // the row lands in the right schema, not the public schema.
        const schemaName = getCurrentSchemaName();
        const client = await pool.connect();
        try {
          if (schemaName) {
            await client.query(`SET search_path TO "${schemaName}", public`);
          }
          const result = await client.query(
            `INSERT INTO homework (class_id, section_id, subject, title, description, due_date, teacher_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [classId, sectionId || null, subject, title, description || "", dueDate, teacherId]
          );
          rows = result.rows;
        } finally {
          client.release();
        }
      } else {
        throw dbErr;
      }
    }

    // Fire-and-forget push notifications to parents in this class
    notifyHomeworkAssigned({ classId, sectionId: sectionId || undefined, subject, title }).catch(() => {});
    return res.status(201).json(rows[0]);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to save homework" });
  }
});

// PUT /homework/:id
router.put("/homework/:id", requireAuth("admin", "teacher"), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { subject, title, description, titleHi, descriptionHi, dueDate } = req.body as {
      subject?: string; title?: string; description?: string; titleHi?: string; descriptionHi?: string; dueDate?: string;
    };
    const update: Record<string, unknown> = {};
    if (subject) update.subject = subject;
    if (title) update.title = title;
    if (description !== undefined) update.description = description;
    if (titleHi !== undefined) update.titleHi = titleHi;
    if (descriptionHi !== undefined) update.descriptionHi = descriptionHi;
    if (dueDate) update.dueDate = dueDate;
    const rows = await db.update(homeworkTable).set(update).where(eq(homeworkTable.id, id)).returning();
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    return res.json(rows[0]);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to update homework" });
  }
});

// DELETE /homework/:id
router.delete("/homework/:id", requireAuth("admin", "teacher"), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    await db.delete(homeworkTable).where(eq(homeworkTable.id, id));
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to delete homework" });
  }
});

export default router;
