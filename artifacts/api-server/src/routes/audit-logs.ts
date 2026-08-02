import { Router } from "express";
import { db, auditLogsTable } from "@workspace/db";
import { desc, and, gte } from "drizzle-orm";
import { requireAuth } from "../lib/auth-middleware";

const router = Router();

router.get("/audit-logs", requireAuth("admin"), async (req, res) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? "200")), 500);
    const since = req.query.since ? String(req.query.since) : null;

    const conditions = since ? [gte(auditLogsTable.createdAt, new Date(since))] : [];

    const logs = await db
      .select()
      .from(auditLogsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(limit);

    res.json(logs);
  } catch (err) {
    req.log.error({ err }, "Failed to list audit logs");
    res.status(500).json({ error: "Failed to list audit logs" });
  }
});

router.post("/audit-logs", async (req, res) => {
  try {
    const { actorName, actorRole, action, description, entityType, entityId, metadata } = req.body;

    if (!action) {
      res.status(400).json({ error: "action is required" });
      return;
    }

    const [log] = await db
      .insert(auditLogsTable)
      .values({
        actorName: actorName ?? "Admin",
        actorRole: actorRole ?? "admin",
        action,
        description: description ?? "",
        entityType: entityType ?? "",
        entityId: entityId ?? null,
        metadata: typeof metadata === "object" ? JSON.stringify(metadata) : (metadata ?? "{}"),
      })
      .returning();

    res.status(201).json(log);
  } catch (err) {
    req.log.error({ err }, "Failed to create audit log");
    res.status(500).json({ error: "Failed to create audit log" });
  }
});

export default router;
