import { Router } from "express";
import { db } from "@workspace/db";
import {
  occasionalCollectionsTable,
  occasionalCollectionPaymentsTable,
  studentsTable,
  classesTable,
  sectionsTable,
  teachersTable,
} from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth-middleware";

const router = Router();

// ─── Admin: List all occasional collections (filtered by session) ─────────────
router.get("/occasional-collections", requireAuth("admin", "teacher"), async (req, res) => {
  const session = req.query.session as string | undefined;
  let rows = await db
    .select()
    .from(occasionalCollectionsTable)
    .orderBy(desc(occasionalCollectionsTable.createdAt));
  if (session && session.trim()) {
    rows = rows.filter((r) => r.session === session.trim());
  }
  return res.json(
    rows.map((r) => ({
      ...r,
      amount: parseFloat(String(r.amount)),
    })),
  );
});

// ─── Admin: Create occasional collection ─────────────────────────────────────
router.post("/occasional-collections", requireAuth("admin"), async (req, res) => {
  const { title, description, amount, session } = req.body;
  if (!title || !amount || !session) {
    return res.status(400).json({ error: "title, amount and session are required" });
  }
  const [row] = await db
    .insert(occasionalCollectionsTable)
    .values({
      title: String(title).trim(),
      description: description ? String(description).trim() : "",
      amount: String(parseFloat(amount) || 0),
      session: String(session).trim(),
    })
    .returning();
  return res.status(201).json({ ...row, amount: parseFloat(String(row.amount)) });
});

// ─── Admin: Delete occasional collection ─────────────────────────────────────
router.delete("/occasional-collections/:id", requireAuth("admin"), async (req, res) => {
  const id = parseInt(req.params["id"] as string, 10);
  if (isNaN(id)) return res.status(400).json({ error: "invalid id" });
  // Delete payments first
  await db
    .delete(occasionalCollectionPaymentsTable)
    .where(eq(occasionalCollectionPaymentsTable.collectionId, id));
  await db
    .delete(occasionalCollectionsTable)
    .where(eq(occasionalCollectionsTable.id, id));
  return res.status(204).end();
});

// ─── Admin: Class-level summary for an occasion ───────────────────────────────
router.get(
  "/occasional-collections/:id/class-summary",
  requireAuth("admin"),
  async (req, res) => {
    const collectionId = parseInt(req.params["id"] as string, 10);
    if (isNaN(collectionId)) return res.status(400).json({ error: "invalid id" });

    const [collection] = await db
      .select()
      .from(occasionalCollectionsTable)
      .where(eq(occasionalCollectionsTable.id, collectionId));
    if (!collection) return res.status(404).json({ error: "collection not found" });

    const totalAmount = parseFloat(String(collection.amount));

    // All classes
    const classes = await db.select().from(classesTable);

    // All students grouped by class (just need counts + ids per class)
    const allStudents = await db
      .select({
        id: studentsTable.id,
        classId: studentsTable.classId,
        sectionId: studentsTable.sectionId,
      })
      .from(studentsTable);

    // All sections
    const sections = await db.select().from(sectionsTable);
    const sectionMap = new Map(sections.map((s) => [s.id, s]));

    // Teachers assigned to each class
    const teachers = await db
      .select({
        id: teachersTable.id,
        name: teachersTable.name,
        classAssigned: teachersTable.classAssigned,
        sectionAssigned: teachersTable.sectionAssigned,
      })
      .from(teachersTable)
      .where(sql`${teachersTable.classAssigned} IS NOT NULL`);

    // Map classId → list of teachers assigned
    const teachersByClass = new Map<number, { name: string; sectionAssigned: number | null }[]>();
    for (const t of teachers) {
      if (t.classAssigned == null) continue;
      const list = teachersByClass.get(t.classAssigned) ?? [];
      list.push({ name: t.name, sectionAssigned: t.sectionAssigned });
      teachersByClass.set(t.classAssigned, list);
    }

    // All payments for this collection
    const payments = await db
      .select()
      .from(occasionalCollectionPaymentsTable)
      .where(eq(occasionalCollectionPaymentsTable.collectionId, collectionId));

    const paymentByStudent = new Map(payments.map((p) => [p.studentId, p]));

    // Build per-class summary
    const result = [];
    for (const cls of classes) {
      const classStudents = allStudents.filter((s) => s.classId === cls.id);
      if (classStudents.length === 0) continue; // skip empty classes

      const classTeachers = teachersByClass.get(cls.id) ?? [];

      let paidCount = 0;
      let partialCount = 0;
      let unpaidCount = 0;
      let paidAmount = 0;
      let partialAmount = 0;

      for (const student of classStudents) {
        const payment = paymentByStudent.get(student.id);
        if (!payment || payment.status === "unpaid") {
          unpaidCount++;
        } else if (payment.status === "paid") {
          paidCount++;
          paidAmount += parseFloat(String(payment.paidAmount));
        } else if (payment.status === "partial") {
          partialCount++;
          partialAmount += parseFloat(String(payment.paidAmount));
        }
      }

      const totalDue = classStudents.length * totalAmount;
      const totalCollected = paidAmount + partialAmount;
      const collectionPct = totalDue > 0 ? Math.round((totalCollected / totalDue) * 100) : 0;

      // Determine sections present in this class
      const sectionIds = [...new Set(classStudents.map((s) => s.sectionId).filter(Boolean))];
      const classSections = sectionIds.map((sid) => sectionMap.get(sid!)).filter(Boolean);

      result.push({
        classId: cls.id,
        className: cls.name,
        sections: classSections.map((s) => ({ id: s!.id, name: s!.name })),
        teachers: classTeachers,
        totalStudents: classStudents.length,
        paidCount,
        paidAmount,
        partialCount,
        partialAmount,
        unpaidCount,
        totalDue,
        totalCollected,
        collectionPct,
        perStudentAmount: totalAmount,
      });
    }

    // Sort by class name
    result.sort((a, b) => a.className.localeCompare(b.className, undefined, { numeric: true }));

    return res.json({ collection: { ...collection, amount: totalAmount }, classes: result });
  },
);

// ─── Teacher: Get payments for a collection (by classId) ──────────────────────
router.get(
  "/occasional-collections/:id/payments",
  requireAuth("admin", "teacher"),
  async (req, res) => {
    const collectionId = parseInt(req.params["id"] as string, 10);
    if (isNaN(collectionId)) return res.status(400).json({ error: "invalid id" });

    const classId = parseInt(req.query.classId as string, 10);
    if (isNaN(classId)) return res.status(400).json({ error: "classId is required" });

    // Get collection details
    const [collection] = await db
      .select()
      .from(occasionalCollectionsTable)
      .where(eq(occasionalCollectionsTable.id, collectionId));
    if (!collection) return res.status(404).json({ error: "collection not found" });

    // Get all students in the class
    const students = await db
      .select({
        id: studentsTable.id,
        studentName: studentsTable.studentName,
        rollNo: studentsTable.rollNo,
        sectionId: studentsTable.sectionId,
        sectionName: sectionsTable.name,
      })
      .from(studentsTable)
      .leftJoin(sectionsTable, eq(studentsTable.sectionId, sectionsTable.id))
      .where(eq(studentsTable.classId, classId))
      .orderBy(studentsTable.rollNo);

    // Get existing payments
    const payments = await db
      .select()
      .from(occasionalCollectionPaymentsTable)
      .where(eq(occasionalCollectionPaymentsTable.collectionId, collectionId));

    const paymentMap = new Map(payments.map((p) => [p.studentId, p]));

    const totalAmount = parseFloat(String(collection.amount));

    const result = students.map((s) => {
      const payment = paymentMap.get(s.id);
      const paidAmount = payment ? parseFloat(String(payment.paidAmount)) : 0;
      const status = payment ? payment.status : "unpaid";
      return {
        studentId: s.id,
        studentName: s.studentName,
        rollNo: s.rollNo,
        sectionId: s.sectionId,
        sectionName: s.sectionName,
        paymentId: payment?.id ?? null,
        paidAmount,
        status,
        totalAmount,
      };
    });

    return res.json({
      collection: { ...collection, amount: totalAmount },
      students: result,
    });
  },
);

// ─── Teacher: Record / update payment ────────────────────────────────────────
router.post(
  "/occasional-collections/:id/payments",
  requireAuth("admin", "teacher"),
  async (req, res) => {
    const collectionId = parseInt(req.params["id"] as string, 10);
    if (isNaN(collectionId)) return res.status(400).json({ error: "invalid id" });

    const { studentId, addAmount, markPaid } = req.body;
    if (!studentId) return res.status(400).json({ error: "studentId is required" });

    const [collection] = await db
      .select()
      .from(occasionalCollectionsTable)
      .where(eq(occasionalCollectionsTable.id, collectionId));
    if (!collection) return res.status(404).json({ error: "collection not found" });

    const totalAmount = parseFloat(String(collection.amount));

    // Get existing payment
    const [existing] = await db
      .select()
      .from(occasionalCollectionPaymentsTable)
      .where(
        and(
          eq(occasionalCollectionPaymentsTable.collectionId, collectionId),
          eq(occasionalCollectionPaymentsTable.studentId, studentId),
        ),
      );

    let newPaidAmount: number;
    let newStatus: string;

    if (markPaid) {
      // Mark as fully paid
      newPaidAmount = totalAmount;
      newStatus = "paid";
    } else {
      // Add partial amount
      const prev = existing ? parseFloat(String(existing.paidAmount)) : 0;
      newPaidAmount = prev + parseFloat(String(addAmount || 0));
      if (newPaidAmount >= totalAmount) {
        newPaidAmount = totalAmount;
        newStatus = "paid";
      } else {
        newStatus = "partial";
      }
    }

    let row: typeof occasionalCollectionPaymentsTable.$inferSelect;
    if (existing) {
      [row] = await db
        .update(occasionalCollectionPaymentsTable)
        .set({
          paidAmount: String(newPaidAmount),
          status: newStatus,
          updatedAt: new Date(),
        })
        .where(eq(occasionalCollectionPaymentsTable.id, existing.id))
        .returning();
    } else {
      [row] = await db
        .insert(occasionalCollectionPaymentsTable)
        .values({
          collectionId,
          studentId,
          paidAmount: String(newPaidAmount),
          status: newStatus,
        })
        .returning();
    }

    return res.json({ ...row, paidAmount: parseFloat(String(row.paidAmount)) });
  },
);

export default router;
