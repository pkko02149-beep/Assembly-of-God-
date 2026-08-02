import { Router } from "express";
import { db, transportRoutesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

router.get("/transport-routes", async (_req, res) => {
  const rows = await db.select().from(transportRoutesTable).orderBy(transportRoutesTable.id);
  res.json(rows.map(r => ({ ...r, pricePerMonth: parseFloat(r.pricePerMonth ?? "0"), createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt })));
});

router.post("/transport-routes", async (req, res) => {
  const { name, pricePerMonth } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "name is required" });
  const price = parseFloat(pricePerMonth) || 0;
  const [route] = await db.insert(transportRoutesTable).values({
    name: name.trim(),
    pricePerMonth: String(price),
  }).returning();
  logger.info({ routeId: route.id }, "Transport route created");
  return res.status(201).json({ ...route, pricePerMonth: parseFloat(route.pricePerMonth ?? "0"), createdAt: route.createdAt.toISOString() });
});

router.patch("/transport-routes/:id", async (req, res) => {
  const id = parseInt(req.params['id'] as string, 10);
  if (isNaN(id)) return res.status(400).json({ error: "invalid id" });
  const { name, pricePerMonth } = req.body;
  const updates: any = {};
  if (name) updates.name = name.trim();
  if (pricePerMonth != null) updates.pricePerMonth = String(parseFloat(pricePerMonth) || 0);
  const [route] = await db.update(transportRoutesTable).set(updates).where(eq(transportRoutesTable.id, id)).returning();
  return res.json({ ...route, pricePerMonth: parseFloat(route.pricePerMonth ?? "0"), createdAt: route.createdAt instanceof Date ? route.createdAt.toISOString() : route.createdAt });
});

router.delete("/transport-routes/:id", async (req, res) => {
  const id = parseInt(req.params['id'] as string, 10);
  if (isNaN(id)) return res.status(400).json({ error: "invalid id" });
  await db.delete(transportRoutesTable).where(eq(transportRoutesTable.id, id));
  logger.info({ routeId: id }, "Transport route deleted");
  return res.status(204).end();
});

export default router;
