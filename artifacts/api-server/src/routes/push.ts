import { Router } from "express";
import { db, pushSubscriptionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth-middleware";
import { initVapid } from "../lib/push";
import { logger } from "../lib/logger";

const router = Router();

// GET /push/vapid-public-key — return public VAPID key to frontend
router.get("/push/vapid-public-key", async (_req, res) => {
  const publicKey = await initVapid();
  return res.json({ publicKey });
});

// POST /push/subscribe — parent saves their push subscription
router.post("/push/subscribe", requireAuth("parent"), async (req, res) => {
  const parentId = req.user!.id;
  const { endpoint, keys } = req.body as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: "endpoint and keys (p256dh, auth) are required" });
  }

  const existing = await db
    .select()
    .from(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.endpoint, endpoint));

  if (existing.length > 0) {
    return res.json({ ok: true, alreadySubscribed: true });
  }

  await db.insert(pushSubscriptionsTable).values({
    parentId,
    endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
  });

  logger.info({ parentId }, "Parent subscribed to push notifications");
  return res.json({ ok: true });
});

// DELETE /push/unsubscribe — parent removes their push subscription
router.delete("/push/unsubscribe", requireAuth("parent"), async (req, res) => {
  const parentId = req.user!.id;
  const { endpoint } = req.body as { endpoint?: string };

  if (!endpoint) {
    await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.parentId, parentId));
  } else {
    await db
      .delete(pushSubscriptionsTable)
      .where(
        and(
          eq(pushSubscriptionsTable.parentId, parentId),
          eq(pushSubscriptionsTable.endpoint, endpoint),
        ),
      );
  }

  logger.info({ parentId }, "Parent unsubscribed from push notifications");
  return res.json({ ok: true });
});

// GET /push/status — check if parent has any active subscriptions
router.get("/push/status", requireAuth("parent"), async (req, res) => {
  const parentId = req.user!.id;
  const subs = await db
    .select({ id: pushSubscriptionsTable.id })
    .from(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.parentId, parentId));
  return res.json({ subscribed: subs.length > 0 });
});

export default router;
