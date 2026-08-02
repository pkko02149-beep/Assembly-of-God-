import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, parentsTable, studentParentTable, studentsTable, classesTable, sectionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth-middleware";
import { logger } from "../lib/logger";

const router = Router();

// GET /parents — admin panel (no server-side auth, matching existing pattern)
// Only returns parents who have at least one student enrolled in the CURRENT
// academic session. The `db` proxy routes `studentsTable` to the current
// session schema automatically, so parents from older sessions are excluded.
router.get("/parents", async (_req, res) => {
  const rows = await db
    .selectDistinct({
      id: parentsTable.id,
      fatherName: parentsTable.fatherName,
      motherName: parentsTable.motherName,
      email: parentsTable.email,
      mobile: parentsTable.mobile,
      createdAt: parentsTable.createdAt,
    })
    .from(parentsTable)
    .innerJoin(studentParentTable, eq(studentParentTable.parentId, parentsTable.id))
    .innerJoin(studentsTable, eq(studentsTable.id, studentParentTable.studentId));
  return res.json(rows);
});

// GET /parents/:id/students — admin or the parent themselves (JWT required for parents)
router.get("/parents/:id/students", async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const { verifyToken } = await import("../lib/jwt");
    try {
      const payload = verifyToken(auth.slice(7));
      if (payload.role === "parent" && payload.id !== id) {
        return res.status(403).json({ error: "Forbidden" });
      }
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }
  }
  // Use innerJoin so only students that exist in the CURRENT session's schema
  // are returned. A leftJoin would leak student IDs from previous sessions
  // (where the link row exists in the public studentParentTable but the
  // matching student row no longer exists in this session's studentsTable).
  const rows = await db
    .select({
      studentId: studentParentTable.studentId,
      studentName: studentsTable.studentName,
      fatherName: studentsTable.fatherName,
      classId: studentsTable.classId,
      sectionId: studentsTable.sectionId,
      rollNo: studentsTable.rollNo,
      className: classesTable.name,
      sectionName: sectionsTable.name,
    })
    .from(studentParentTable)
    .innerJoin(studentsTable, eq(studentParentTable.studentId, studentsTable.id))
    .leftJoin(classesTable, eq(studentsTable.classId, classesTable.id))
    .leftJoin(sectionsTable, eq(studentsTable.sectionId, sectionsTable.id))
    .where(eq(studentParentTable.parentId, id));
  return res.json(rows);
});

// POST /parents — admin creates parent
router.post("/parents", async (req, res) => {
  const { fatherName, motherName, email, mobile, password } = req.body as {
    fatherName?: string; motherName?: string; email?: string; mobile?: string; password?: string;
  };
  if (!email || !password) return res.status(400).json({ error: "email and password are required" });
  const passwordHash = await bcrypt.hash(password, 10);
  const rows = await db.insert(parentsTable).values({
    fatherName: fatherName || "", motherName: motherName || "",
    email: email.toLowerCase().trim(), mobile: mobile || "", passwordHash,
  }).returning();
  const { passwordHash: _, ...safe } = rows[0];
  logger.info({ parentId: rows[0].id }, "Parent created");
  return res.status(201).json(safe);
});

// POST /parents/:id/link-student — admin links a student to a parent
router.post("/parents/:id/link-student", async (req, res) => {
  const parentId = parseInt(req.params.id as string, 10);
  const { studentId } = req.body as { studentId?: number };
  if (!studentId) return res.status(400).json({ error: "studentId required" });
  try {
    const rows = await db.insert(studentParentTable).values({ parentId, studentId }).returning();
    return res.status(201).json(rows[0]);
  } catch {
    return res.status(409).json({ error: "Student already linked" });
  }
});

// DELETE /parents/:id/link-student/:studentId
router.delete("/parents/:id/link-student/:studentId", async (req, res) => {
  const parentId = parseInt(req.params.id as string, 10);
  const studentId = parseInt(req.params.studentId as string, 10);
  await db.delete(studentParentTable)
    .where(eq(studentParentTable.parentId, parentId));
  return res.json({ ok: true });
});

// PUT /parents/:id — admin or the parent themselves
router.put("/parents/:id", async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const { verifyToken } = await import("../lib/jwt");
    try {
      const payload = verifyToken(auth.slice(7));
      if (payload.role === "parent" && payload.id !== id) {
        return res.status(403).json({ error: "Forbidden" });
      }
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }
  }
  const { fatherName, motherName, mobile, password } = req.body as {
    fatherName?: string; motherName?: string; mobile?: string; password?: string;
  };
  const update: Record<string, unknown> = {};
  if (fatherName !== undefined) update.fatherName = fatherName;
  if (motherName !== undefined) update.motherName = motherName;
  if (mobile !== undefined) update.mobile = mobile;
  if (password) update.passwordHash = await bcrypt.hash(password, 10);
  const rows = await db.update(parentsTable).set(update).where(eq(parentsTable.id, id)).returning();
  if (!rows[0]) return res.status(404).json({ error: "Parent not found" });
  const { passwordHash: _, ...safe } = rows[0];
  return res.json(safe);
});

// DELETE /parents/:id — admin only
router.delete("/parents/:id", async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  await db.delete(parentsTable).where(eq(parentsTable.id, id));
  return res.json({ ok: true });
});

// GET /parents/me — requires JWT (parent portal)
router.get("/parents/me", requireAuth("parent"), async (req, res) => {
  const id = req.user!.id;
  const rows = await db.select().from(parentsTable).where(eq(parentsTable.id, id));
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  const { passwordHash: _, ...safe } = rows[0];
  return res.json(safe);
});

export default router;
