import { Router } from "express";
import { db } from "@workspace/db";
import { expendituresTable } from "@workspace/db";
import { eq, desc, and, gte, lte } from "drizzle-orm";

const router = Router();

router.get("/expenditures", async (req, res) => {
  const { fromDate, toDate, category } = req.query;
  const conditions: any[] = [];
  if (fromDate) conditions.push(gte(expendituresTable.date, String(fromDate)));
  if (toDate) conditions.push(lte(expendituresTable.date, String(toDate)));
  if (category && category !== "all") conditions.push(eq(expendituresTable.category, String(category)));

  const rows = await db.select().from(expendituresTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(expendituresTable.date));

  return res.json(rows.map(r => ({
    ...r,
    amount: parseFloat(String(r.amount)),
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
  })));
});

router.post("/expenditures", async (req, res) => {
  const { title, amount, category, paymentMethod, date, description, billNo, paidTo } = req.body;
  if (!title || !amount || !date) {
    return res.status(400).json({ error: "title, amount, date are required" });
  }

  const [row] = await db.insert(expendituresTable).values({
    title: String(title).trim(),
    amount: String(parseFloat(amount) || 0),
    category: category ? String(category).trim() : "general",
    paymentMethod: paymentMethod ? String(paymentMethod).trim() : "cash",
    date: String(date),
    description: description ? String(description).trim() : "",
    billNo: billNo ? String(billNo).trim() : "",
    paidTo: paidTo ? String(paidTo).trim() : "",
  }).returning();

  return res.status(201).json({ ...row, amount: parseFloat(String(row.amount)) });
});

router.patch("/expenditures/:id", async (req, res) => {
  const id = parseInt(req.params['id'] as string, 10);
  if (isNaN(id)) return res.status(400).json({ error: "invalid id" });

  const { title, amount, category, paymentMethod, date, description, billNo, paidTo } = req.body;

  await db.update(expendituresTable).set({
    title: title ? String(title).trim() : undefined,
    amount: amount != null ? String(parseFloat(amount) || 0) : undefined,
    category: category ? String(category).trim() : undefined,
    paymentMethod: paymentMethod ? String(paymentMethod).trim() : undefined,
    date: date ? String(date) : undefined,
    description: description !== undefined ? String(description).trim() : undefined,
    billNo: billNo !== undefined ? String(billNo).trim() : undefined,
    paidTo: paidTo !== undefined ? String(paidTo).trim() : undefined,
  }).where(eq(expendituresTable.id, id));

  const [row] = await db.select().from(expendituresTable).where(eq(expendituresTable.id, id));
  return res.json({ ...row, amount: parseFloat(String(row.amount)) });
});

router.delete("/expenditures/:id", async (req, res) => {
  const id = parseInt(req.params['id'] as string, 10);
  if (isNaN(id)) return res.status(400).json({ error: "invalid id" });
  await db.delete(expendituresTable).where(eq(expendituresTable.id, id));
  return res.status(204).end();
});

export default router;
