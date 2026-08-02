import { getStaffUser, isAdmin } from "@/lib/auth";

export async function logAudit(params: {
  action: string;
  description: string;
  entityType?: string;
  entityId?: number;
  metadata?: Record<string, unknown>;
}) {
  try {
    const staff = !isAdmin() ? getStaffUser() : null;
    const actorName = staff ? staff.name : "Admin";
    const actorRole = staff ? staff.role : "admin";

    await fetch("/api/audit-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actorName,
        actorRole,
        action: params.action,
        description: params.description,
        entityType: params.entityType ?? "",
        entityId: params.entityId,
        metadata: params.metadata ?? {},
      }),
    });
  } catch {
    // audit log failures are non-fatal
  }
}
