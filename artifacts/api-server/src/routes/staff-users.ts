import { Router } from "express";
import { db } from "@workspace/db";
import { staffUsersTable } from "@workspace/db";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { requireAuth } from "../lib/auth-middleware";
import { logAudit } from "../lib/audit";

const router = Router();

router.post("/auth/staff-login", async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) return res.status(400).json({ error: "Username and password required" });
  try {
    const [user] = await db.select().from(staffUsersTable).where(eq(staffUsersTable.username, username));
    if (!user || !user.active) {
      await logAudit({
        actorName: username,
        actorRole: "staff",
        action: "staff_login_failed",
        description: `Failed staff login attempt (username: ${username})`,
        entityType: "staff_user",
        metadata: { username, reason: !user ? "user_not_found" : "account_inactive" },
      });
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      await logAudit({
        actorName: username,
        actorRole: "staff",
        action: "staff_login_failed",
        description: `Failed staff login attempt (username: ${username})`,
        entityType: "staff_user",
        metadata: { username, reason: "wrong_password" },
      });
      return res.status(401).json({ error: "Invalid credentials" });
    }
    logger.info({ username }, "Staff user logged in");
    await logAudit({
      actorName: user.name,
      actorRole: user.role,
      action: "staff_login",
      description: `Staff login successful (${user.name} / ${username})`,
      entityType: "staff_user",
      entityId: user.id,
    });
    return res.json({ ok: true, user: { id: user.id, username: user.username, name: user.name, role: user.role, permissions: JSON.parse(user.permissions || "{}") } });
  } catch (err: any) {
    logger.error({ err: err.message }, "Staff login error");
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/staff-users", requireAuth("admin"), async (_req, res) => {
  const users = await db.select({
    id: staffUsersTable.id,
    username: staffUsersTable.username,
    name: staffUsersTable.name,
    role: staffUsersTable.role,
    permissions: staffUsersTable.permissions,
    active: staffUsersTable.active,
    createdAt: staffUsersTable.createdAt,
  }).from(staffUsersTable);
  return res.json(users);
});

router.post("/staff-users", requireAuth("admin"), async (req, res) => {
  const { username, password, name, role, permissions } = req.body as { username?: string; password?: string; name?: string; role?: string; permissions?: Record<string, any> };
  if (!username || !password || !name) return res.status(400).json({ error: "username, password and name are required" });
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db.insert(staffUsersTable).values({
      username, passwordHash, name,
      role: role || "accountant",
      permissions: JSON.stringify(permissions || {}),
      active: true,
    }).returning();
    await logAudit({
      action: "staff_user_created",
      description: `Staff user created: ${name} (${username}), role: ${role || "accountant"}`,
      entityType: "staff_user",
      entityId: user.id,
      metadata: { username, name, role: role || "accountant" },
    });
    return res.json({ id: user.id, username: user.username, name: user.name, role: user.role, permissions: user.permissions, active: user.active });
  } catch (err: any) {
    if (err.message?.includes("unique")) return res.status(409).json({ error: "Username already exists" });
    logger.error({ err: err.message }, "Create staff user error");
    return res.status(500).json({ error: "Server error" });
  }
});

router.patch("/staff-users/:id", requireAuth("admin"), async (req, res) => {
  const id = parseInt(req.params['id'] as string, 10);
  if (isNaN(id)) return res.status(400).json({ error: "invalid id" });
  const { username, password, name, role, permissions, active } = req.body as { username?: string; password?: string; name?: string; role?: string; permissions?: Record<string, any>; active?: boolean };
  const updates: Record<string, any> = {};
  const changedFields: string[] = [];
  if (username != null) { updates.username = username; changedFields.push("username"); }
  if (name != null) { updates.name = name; changedFields.push("name"); }
  if (role != null) { updates.role = role; changedFields.push("role"); }
  if (permissions != null) { updates.permissions = JSON.stringify(permissions); changedFields.push("permissions"); }
  if (active != null) { updates.active = active; changedFields.push(active ? "activated" : "deactivated"); }
  if (password) { updates.passwordHash = await bcrypt.hash(password, 10); changedFields.push("password"); }
  try {
    const [user] = await db.update(staffUsersTable).set(updates).where(eq(staffUsersTable.id, id)).returning();
    await logAudit({
      action: "staff_user_updated",
      description: `Staff user updated: ${user.name} (${user.username}) — ${changedFields.join(", ")}`,
      entityType: "staff_user",
      entityId: id,
      metadata: { changedFields, username: user.username, name: user.name },
    });
    return res.json({ id: user.id, username: user.username, name: user.name, role: user.role, permissions: user.permissions, active: user.active });
  } catch (err: any) {
    if (err.message?.includes("unique")) return res.status(409).json({ error: "Username already exists" });
    return res.status(500).json({ error: "Server error" });
  }
});

router.delete("/staff-users/:id", requireAuth("admin"), async (req, res) => {
  const id = parseInt(req.params['id'] as string, 10);
  if (isNaN(id)) return res.status(400).json({ error: "invalid id" });
  const [deleted] = await db.select({ username: staffUsersTable.username, name: staffUsersTable.name }).from(staffUsersTable).where(eq(staffUsersTable.id, id));
  await db.delete(staffUsersTable).where(eq(staffUsersTable.id, id));
  await logAudit({
    action: "staff_user_deleted",
    description: `Staff user deleted: ${deleted?.name ?? "unknown"} (${deleted?.username ?? id})`,
    entityType: "staff_user",
    entityId: id,
    metadata: { username: deleted?.username, name: deleted?.name },
  });
  return res.status(204).end();
});

export default router;
