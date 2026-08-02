import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, globalDb, teacherDocumentsTable, downloadsTable, teachersTable, classesTable } from "@workspace/db";
import { requireAuth } from "../lib/auth-middleware";
import { logger } from "../lib/logger";

const router = Router();

// GET /teacher-documents/for-parent — parent sees teacher docs (current session)
// + admin downloads from public schema.
// Must be defined BEFORE the /:id route so Express doesn't confuse "for-parent".
router.get("/teacher-documents/for-parent", requireAuth("parent"), async (_req, res) => {
  try {
    const teacherDocs = await db
      .select()
      .from(teacherDocumentsTable)
      .orderBy(teacherDocumentsTable.createdAt);

    const adminDownloads = await globalDb
      .select()
      .from(downloadsTable)
      .where(eq(downloadsTable.isVisible, true))
      .orderBy(downloadsTable.createdAt);

    return res.json({
      teacherDocs: teacherDocs.reverse(),
      adminDownloads: adminDownloads.reverse(),
    });
  } catch (err) {
    logger.error({ err }, "Failed to fetch parent documents");
    return res.status(500).json({ error: "Failed to fetch documents" });
  }
});

// GET /teacher-documents — teacher fetches all docs for their assigned class
router.get("/teacher-documents", requireAuth("teacher"), async (req, res) => {
  const teacherId = (req as any).user.id as number;
  try {
    const teacherRow = await db
      .select()
      .from(teachersTable)
      .where(eq(teachersTable.id, teacherId))
      .then((r) => r[0]);

    if (!teacherRow?.classAssigned) {
      return res.json([]);
    }

    const docs = await db
      .select()
      .from(teacherDocumentsTable)
      .where(eq(teacherDocumentsTable.classId, teacherRow.classAssigned))
      .orderBy(teacherDocumentsTable.createdAt);

    return res.json(docs.reverse());
  } catch (err) {
    logger.error({ err }, "Failed to fetch teacher documents");
    return res.status(500).json({ error: "Failed to fetch documents" });
  }
});

// POST /teacher-documents — teacher uploads a new document
router.post("/teacher-documents", requireAuth("teacher"), async (req, res) => {
  const teacherId = (req as any).user.id as number;
  const teacherName = ((req as any).user.name as string) || "";
  const { title, subject, description, fileUrl, fileType } = req.body as {
    title?: string;
    subject?: string;
    description?: string;
    fileUrl?: string;
    fileType?: string;
  };

  if (!title?.trim() || !fileUrl?.trim()) {
    return res.status(400).json({ error: "Title and file URL are required" });
  }

  try {
    const teacherRow = await db
      .select()
      .from(teachersTable)
      .where(eq(teachersTable.id, teacherId))
      .then((r) => r[0]);

    if (!teacherRow?.classAssigned) {
      return res.status(400).json({ error: "No class assigned to this teacher" });
    }

    // Resolve class name
    const classRow = await globalDb
      .select({ name: classesTable.name })
      .from(classesTable)
      .where(eq(classesTable.id, teacherRow.classAssigned))
      .then((r) => r[0]);

    const [doc] = await db
      .insert(teacherDocumentsTable)
      .values({
        title: title.trim(),
        subject: subject?.trim() || teacherRow.subject || "",
        description: description?.trim() || "",
        fileUrl: fileUrl.trim(),
        fileType: fileType || "pdf",
        teacherId,
        teacherName,
        classId: teacherRow.classAssigned,
        className: classRow?.name || "",
        sectionId: teacherRow.sectionAssigned ?? null,
        sectionName: "",
      })
      .returning();

    logger.info({ teacherId, docId: doc.id }, "Teacher document uploaded");
    return res.json(doc);
  } catch (err) {
    logger.error({ err }, "Failed to create teacher document");
    return res.status(500).json({ error: "Failed to upload document" });
  }
});

// DELETE /teacher-documents/:id — teacher deletes their own document
router.delete("/teacher-documents/:id", requireAuth("teacher"), async (req, res) => {
  const teacherId = (req as any).user.id as number;
  const docId = parseInt(req.params.id, 10);
  if (isNaN(docId)) return res.status(400).json({ error: "Invalid document ID" });

  try {
    const existing = await db
      .select()
      .from(teacherDocumentsTable)
      .where(and(eq(teacherDocumentsTable.id, docId), eq(teacherDocumentsTable.teacherId, teacherId)))
      .then((r) => r[0]);

    if (!existing) {
      return res.status(404).json({ error: "Document not found or not authorized" });
    }

    await db.delete(teacherDocumentsTable).where(eq(teacherDocumentsTable.id, docId));
    logger.info({ teacherId, docId }, "Teacher document deleted");
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to delete teacher document");
    return res.status(500).json({ error: "Failed to delete document" });
  }
});

export default router;
