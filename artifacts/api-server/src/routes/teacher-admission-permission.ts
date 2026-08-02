import { Router } from "express";
import { db, teachersTable, teacherAdmissionPermissionsTable, classesTable, sectionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth-middleware";

const router = Router();

function getEffectivelyLocked(perm: { isLocked: boolean; expiresAt: Date | null } | null): boolean {
  if (!perm) return true;
  if (perm.isLocked) return true;
  if (perm.expiresAt && perm.expiresAt <= new Date()) return true;
  return false;
}

// GET /teacher-admission-permission — admin: list all teachers with their permission status
router.get("/teacher-admission-permission", requireAuth("admin"), async (req, res) => {
  const teachers = await db
    .select({
      id: teachersTable.id,
      name: teachersTable.name,
      email: teachersTable.email,
      employeeId: teachersTable.employeeId,
      classAssigned: teachersTable.classAssigned,
      sectionAssigned: teachersTable.sectionAssigned,
      subject: teachersTable.subject,
      className: classesTable.name,
      sectionName: sectionsTable.name,
    })
    .from(teachersTable)
    .leftJoin(classesTable, eq(teachersTable.classAssigned, classesTable.id))
    .leftJoin(sectionsTable, eq(teachersTable.sectionAssigned, sectionsTable.id))
    .orderBy(teachersTable.name);

  const perms = await db.select().from(teacherAdmissionPermissionsTable);
  const permMap = new Map(perms.map((p) => [p.teacherId, p]));

  const result = teachers.map((t) => {
    const perm = permMap.get(t.id) ?? null;
    const effectivelyLocked = getEffectivelyLocked(perm);
    return {
      ...t,
      permission: perm
        ? {
            id: perm.id,
            isLocked: perm.isLocked,
            expiresAt: perm.expiresAt,
            grantedAt: perm.grantedAt,
            updatedAt: perm.updatedAt,
            effectivelyLocked,
          }
        : null,
    };
  });

  return res.json(result);
});

// GET /teacher-admission-permission/my-status — teacher checks their own status
router.get("/teacher-admission-permission/my-status", requireAuth("teacher"), async (req, res) => {
  const teacherId = (req as any).user?.id;
  if (!teacherId) return res.status(401).json({ error: "Unauthorized" });

  const [perm] = await db
    .select()
    .from(teacherAdmissionPermissionsTable)
    .where(eq(teacherAdmissionPermissionsTable.teacherId, teacherId));

  if (!perm) {
    return res.json({ isLocked: true, expiresAt: null, grantedAt: null, effectivelyLocked: true });
  }

  const effectivelyLocked = getEffectivelyLocked(perm);
  return res.json({
    isLocked: perm.isLocked,
    expiresAt: perm.expiresAt,
    grantedAt: perm.grantedAt,
    effectivelyLocked,
  });
});

// POST /teacher-admission-permission/:teacherId — admin: grant/update/lock permission
router.post("/teacher-admission-permission/:teacherId", requireAuth("admin"), async (req, res) => {
  const teacherId = parseInt(req.params["teacherId"] as string, 10);
  if (isNaN(teacherId)) return res.status(400).json({ error: "Invalid teacherId" });

  const { isLocked, durationHours } = req.body;
  // durationHours: null/0 = no expiry, positive = expires in X hours from now

  const now = new Date();
  let expiresAt: Date | null = null;
  let grantedAt: Date | null = null;

  if (!isLocked) {
    grantedAt = now;
    const hrs = parseFloat(durationHours);
    if (!isNaN(hrs) && hrs > 0) {
      expiresAt = new Date(now.getTime() + hrs * 60 * 60 * 1000);
    }
  }

  const [existing] = await db
    .select()
    .from(teacherAdmissionPermissionsTable)
    .where(eq(teacherAdmissionPermissionsTable.teacherId, teacherId));

  if (existing) {
    const [updated] = await db
      .update(teacherAdmissionPermissionsTable)
      .set({ isLocked: !!isLocked, expiresAt, grantedAt, updatedAt: now })
      .where(eq(teacherAdmissionPermissionsTable.teacherId, teacherId))
      .returning();
    return res.json(updated);
  } else {
    const [created] = await db
      .insert(teacherAdmissionPermissionsTable)
      .values({ teacherId, isLocked: !!isLocked, expiresAt, grantedAt, updatedAt: now })
      .returning();
    return res.json(created);
  }
});

export default router;
