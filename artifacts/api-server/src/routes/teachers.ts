import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, teachersTable, classesTable, sectionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth-middleware";
import { logger } from "../lib/logger";

const router = Router();

// GET /teachers — open for admin panel (admin panel has no server-side auth)
router.get("/teachers", async (_req, res) => {
  const rows = await db
    .select({
      id: teachersTable.id,
      employeeId: teachersTable.employeeId,
      name: teachersTable.name,
      email: teachersTable.email,
      mobile: teachersTable.mobile,
      classAssigned: teachersTable.classAssigned,
      className: classesTable.name,
      sectionAssigned: teachersTable.sectionAssigned,
      sectionName: sectionsTable.name,
      subject: teachersTable.subject,
      createdAt: teachersTable.createdAt,
    })
    .from(teachersTable)
    .leftJoin(classesTable, eq(teachersTable.classAssigned, classesTable.id))
    .leftJoin(sectionsTable, eq(teachersTable.sectionAssigned, sectionsTable.id));
  return res.json(rows);
});

// GET /teachers/:id — open for admin panel
router.get("/teachers/:id", async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  const rows = await db.select().from(teachersTable).where(eq(teachersTable.id, id));
  if (!rows[0]) return res.status(404).json({ error: "Teacher not found" });
  const { passwordHash: _, ...safe } = rows[0];
  return res.json(safe);
});

// POST /teachers — admin creates teacher
router.post("/teachers", async (req, res) => {
  const { employeeId, name, email, mobile, password, classAssigned, sectionAssigned, subject } = req.body as {
    employeeId?: string; name?: string; email?: string; mobile?: string;
    password?: string; classAssigned?: number; sectionAssigned?: number; subject?: string;
  };
  if (!employeeId || !name || !email || !password) {
    return res.status(400).json({ error: "employeeId, name, email, password are required" });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const rows = await db.insert(teachersTable).values({
    employeeId, name, email: email.toLowerCase().trim(),
    mobile: mobile || "", passwordHash,
    classAssigned: classAssigned || null,
    sectionAssigned: sectionAssigned || null,
    subject: subject || "",
  }).returning();
  const { passwordHash: _, ...safe } = rows[0];
  logger.info({ teacherId: rows[0].id }, "Teacher created");
  return res.status(201).json(safe);
});

// PUT /teachers/:id — admin updates OR teacher updates own profile (JWT optional)
router.put("/teachers/:id", async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  // If JWT bearer is present, verify teacher can only edit themselves
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const { verifyToken } = await import("../lib/jwt");
    try {
      const payload = verifyToken(auth.slice(7));
      if (payload.role === "teacher" && payload.id !== id) {
        return res.status(403).json({ error: "Forbidden" });
      }
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }
  }
  const { name, mobile, classAssigned, sectionAssigned, subject, password } = req.body as {
    name?: string; mobile?: string; classAssigned?: number; sectionAssigned?: number; subject?: string; password?: string;
  };
  const update: Record<string, unknown> = {};
  if (name) update.name = name;
  if (mobile !== undefined) update.mobile = mobile;
  if (classAssigned !== undefined) update.classAssigned = classAssigned;
  if (sectionAssigned !== undefined) update.sectionAssigned = sectionAssigned;
  if (subject !== undefined) update.subject = subject;
  if (password) update.passwordHash = await bcrypt.hash(password, 10);

  const rows = await db.update(teachersTable).set(update).where(eq(teachersTable.id, id)).returning();
  if (!rows[0]) return res.status(404).json({ error: "Teacher not found" });
  const { passwordHash: _, ...safe } = rows[0];
  return res.json(safe);
});

// DELETE /teachers/:id — admin only
router.delete("/teachers/:id", async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  await db.delete(teachersTable).where(eq(teachersTable.id, id));
  return res.json({ ok: true });
});

// GET /teachers/me — requires JWT (teacher portal)
router.get("/teachers/me", requireAuth("teacher"), async (req, res) => {
  const id = req.user!.id;
  const rows = await db.select().from(teachersTable).where(eq(teachersTable.id, id));
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  const { passwordHash: _, ...safe } = rows[0];
  return res.json(safe);
});

export default router;
