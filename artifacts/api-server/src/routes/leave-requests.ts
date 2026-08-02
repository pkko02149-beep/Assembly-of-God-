import { Router, type Request, type Response, type NextFunction } from "express";
import { db, leaveRequestsTable, teachersTable, parentsTable, studentsTable, classesTable, sectionsTable } from "@workspace/db";
import { eq, and, desc, SQL, or } from "drizzle-orm";
import { verifyToken } from "../lib/jwt";
import { logger } from "../lib/logger";

const router = Router();

function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ") && auth.length > 7) {
    try { req.user = verifyToken(auth.slice(7)); } catch { /* invalid — treat as admin */ }
  }
  next();
}

// GET /leave-requests — enriched with names
router.get("/leave-requests", optionalAuth, async (req, res) => {
  const userType = req.query.userType as string | undefined;
  const userId = req.query.userId as string | undefined;
  const status = req.query.status as string | undefined;

  if (req.user?.role === "teacher") {
    // Teacher sees their own leave requests + student leave requests from their class
    const teacher = await db.select().from(teachersTable).where(eq(teachersTable.id, req.user.id));
    const t = teacher[0];

    // Own leaves
    const ownLeaves = await db
      .select({
        id: leaveRequestsTable.id,
        userType: leaveRequestsTable.userType,
        userId: leaveRequestsTable.userId,
        studentId: leaveRequestsTable.studentId,
        reason: leaveRequestsTable.reason,
        fromDate: leaveRequestsTable.fromDate,
        toDate: leaveRequestsTable.toDate,
        status: leaveRequestsTable.status,
        adminRemarks: leaveRequestsTable.adminRemarks,
        createdAt: leaveRequestsTable.createdAt,
        teacherName: teachersTable.name,
        employeeId: teachersTable.employeeId,
        studentName: studentsTable.studentName,
        fatherName: studentsTable.fatherName,
        className: classesTable.name,
        sectionName: sectionsTable.name,
      })
      .from(leaveRequestsTable)
      .leftJoin(teachersTable, and(
        eq(leaveRequestsTable.userType, "teacher"),
        eq(leaveRequestsTable.userId, teachersTable.id)
      ))
      .leftJoin(studentsTable, eq(leaveRequestsTable.studentId, studentsTable.id))
      .leftJoin(classesTable, eq(studentsTable.classId, classesTable.id))
      .leftJoin(sectionsTable, eq(studentsTable.sectionId, sectionsTable.id))
      .where(and(
        eq(leaveRequestsTable.userType, "teacher"),
        eq(leaveRequestsTable.userId, req.user.id)
      ))
      .orderBy(desc(leaveRequestsTable.createdAt));

    // Student leaves for teacher's class
    let studentLeaves: typeof ownLeaves = [];
    if (t?.classAssigned) {
      const classConditions: SQL<unknown>[] = [
        eq(leaveRequestsTable.userType, "parent"),
        eq(studentsTable.classId, t.classAssigned),
      ];
      if (t.sectionAssigned) classConditions.push(eq(studentsTable.sectionId, t.sectionAssigned));

      studentLeaves = await db
        .select({
          id: leaveRequestsTable.id,
          userType: leaveRequestsTable.userType,
          userId: leaveRequestsTable.userId,
          studentId: leaveRequestsTable.studentId,
          reason: leaveRequestsTable.reason,
          fromDate: leaveRequestsTable.fromDate,
          toDate: leaveRequestsTable.toDate,
          status: leaveRequestsTable.status,
          adminRemarks: leaveRequestsTable.adminRemarks,
          createdAt: leaveRequestsTable.createdAt,
          teacherName: teachersTable.name,
          employeeId: teachersTable.employeeId,
          studentName: studentsTable.studentName,
          fatherName: studentsTable.fatherName,
          className: classesTable.name,
          sectionName: sectionsTable.name,
        })
        .from(leaveRequestsTable)
        .leftJoin(teachersTable, and(
          eq(leaveRequestsTable.userType, "teacher"),
          eq(leaveRequestsTable.userId, teachersTable.id)
        ))
        .leftJoin(studentsTable, eq(leaveRequestsTable.studentId, studentsTable.id))
        .leftJoin(classesTable, eq(studentsTable.classId, classesTable.id))
        .leftJoin(sectionsTable, eq(studentsTable.sectionId, sectionsTable.id))
        .where(and(...classConditions))
        .orderBy(desc(leaveRequestsTable.createdAt));
    }

    return res.json({ ownLeaves, studentLeaves });
  }

  if (req.user?.role === "parent") {
    const rows = await db.select().from(leaveRequestsTable)
      .where(and(eq(leaveRequestsTable.userId, req.user.id), eq(leaveRequestsTable.userType, "parent")))
      .orderBy(desc(leaveRequestsTable.createdAt));
    return res.json(rows);
  }

  // Admin — return all with enriched names
  const conditions: SQL<unknown>[] = [];
  if (userType) conditions.push(eq(leaveRequestsTable.userType, userType));
  if (userId) conditions.push(eq(leaveRequestsTable.userId, parseInt(userId, 10)));
  if (status) conditions.push(eq(leaveRequestsTable.status, status));

  const rows = await db
    .select({
      id: leaveRequestsTable.id,
      userType: leaveRequestsTable.userType,
      userId: leaveRequestsTable.userId,
      studentId: leaveRequestsTable.studentId,
      reason: leaveRequestsTable.reason,
      fromDate: leaveRequestsTable.fromDate,
      toDate: leaveRequestsTable.toDate,
      status: leaveRequestsTable.status,
      adminRemarks: leaveRequestsTable.adminRemarks,
      createdAt: leaveRequestsTable.createdAt,
      teacherName: teachersTable.name,
      employeeId: teachersTable.employeeId,
      studentName: studentsTable.studentName,
      fatherName: studentsTable.fatherName,
      parentFather: parentsTable.fatherName,
      parentMother: parentsTable.motherName,
      className: classesTable.name,
      sectionName: sectionsTable.name,
    })
    .from(leaveRequestsTable)
    .leftJoin(teachersTable, and(
      eq(leaveRequestsTable.userType, "teacher"),
      eq(leaveRequestsTable.userId, teachersTable.id)
    ))
    .leftJoin(parentsTable, and(
      eq(leaveRequestsTable.userType, "parent"),
      eq(leaveRequestsTable.userId, parentsTable.id)
    ))
    .leftJoin(studentsTable, eq(leaveRequestsTable.studentId, studentsTable.id))
    .leftJoin(classesTable, eq(studentsTable.classId, classesTable.id))
    .leftJoin(sectionsTable, eq(studentsTable.sectionId, sectionsTable.id))
    .where(conditions.length ? (conditions.length === 1 ? conditions[0] : and(...conditions)) : undefined)
    .orderBy(desc(leaveRequestsTable.createdAt));

  return res.json(rows);
});

// POST /leave-requests — requires teacher/parent JWT
router.post("/leave-requests", async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  let user;
  try { user = verifyToken(auth.slice(7)); } catch { return res.status(401).json({ error: "Invalid token" }); }

  const { reason, fromDate, toDate, studentId } = req.body as {
    reason?: string; fromDate?: string; toDate?: string; studentId?: number;
  };
  if (!reason || !fromDate || !toDate) {
    return res.status(400).json({ error: "reason, fromDate, toDate are required" });
  }
  const rows = await db.insert(leaveRequestsTable).values({
    userType: user.role,
    userId: user.id,
    studentId: studentId || null,
    reason,
    fromDate,
    toDate,
    status: "pending",
    adminRemarks: "",
  }).returning();
  logger.info({ leaveId: rows[0].id }, "Leave request created");
  return res.status(201).json(rows[0]);
});

// PUT /leave-requests/:id — admin/teacher can approve/reject
router.put("/leave-requests/:id", optionalAuth, async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  const { status, adminRemarks } = req.body as { status?: string; adminRemarks?: string };
  if (!status || !["approved", "rejected", "pending"].includes(status)) {
    return res.status(400).json({ error: "Valid status is required (approved/rejected/pending)" });
  }
  const rows = await db.update(leaveRequestsTable).set({
    status,
    adminRemarks: adminRemarks || "",
  }).where(eq(leaveRequestsTable.id, id)).returning();
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  return res.json(rows[0]);
});

// DELETE /leave-requests/:id
router.delete("/leave-requests/:id", optionalAuth, async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  await db.delete(leaveRequestsTable).where(eq(leaveRequestsTable.id, id));
  return res.json({ ok: true });
});

export default router;
