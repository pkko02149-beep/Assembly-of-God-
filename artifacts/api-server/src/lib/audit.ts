import { db, auditLogsTable } from "@workspace/db";
import { logger } from "./logger";

export interface AuditPayload {
  actorName?: string;
  actorRole?: string;
  action: string;
  description?: string;
  entityType?: string;
  entityId?: number | null;
  metadata?: Record<string, unknown>;
}

export async function logAudit(payload: AuditPayload): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({
      actorName: payload.actorName ?? "Admin",
      actorRole: payload.actorRole ?? "admin",
      action: payload.action,
      description: payload.description ?? "",
      entityType: payload.entityType ?? "",
      entityId: payload.entityId ?? null,
      metadata: JSON.stringify(payload.metadata ?? {}),
    });
  } catch (err) {
    logger.error({ err }, "Failed to write audit log");
  }
}
