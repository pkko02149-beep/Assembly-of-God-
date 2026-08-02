import { Router } from "express";
import { db, examMarksTable, examsTable, subjectsTable, studentsTable, classesTable, sectionsTable, teachersTable, gradingRulesTable, marksAuditLogTable, teacherSubjectAssignmentsTable } from "@workspace/db";
import { eq, and, asc, desc, SQL } from "drizzle-orm";
import { requireAuth } from "../lib/auth-middleware";

const router = Router();

// ─── Grade calculation helper ─────────────────────────────────────────────────
async function calcGrade(percentage: number): Promise<{ grade: string; gradePoint: string }> {
  const rules = await db.select().from(gradingRulesTable).orderBy(asc(gradingRulesTable.minPercent));
  const defaults = [
    { minPercent: "91", maxPercent: "100", grade: "A1", gradePoint: "10.0" },
    { minPercent: "81", maxPercent: "90", grade: "A2", gradePoint: "9.0" },
    { minPercent: "71", maxPercent: "80", grade: "B1", gradePoint: "8.0" },
    { minPercent: "61", maxPercent: "70", grade: "B2", gradePoint: "7.0" },
    { minPercent: "51", maxPercent: "60", grade: "C1", gradePoint: "6.0" },
    { minPercent: "41", maxPercent: "50", grade: "C2", gradePoint: "5.0" },
    { minPercent: "33", maxPercent: "40", grade: "D", gradePoint: "4.0" },
    { minPercent: "0", maxPercent: "32", grade: "E", gradePoint: "0.0" },
  ];
  const list = rules.length > 0 ? rules : defaults;
  for (let i = list.length - 1; i >= 0; i--) {
    const r = list[i];
    if (percentage >= parseFloat(r.minPercent) && percentage <= parseFloat(r.maxPercent)) {
      return { grade: r.grade, gradePoint: r.gradePoint };
    }
  }
  return { grade: "E", gradePoint: "0.0" };
}

function computeTotal(theory: string | null, practical: string | null, internal: string | null): number {
  return (parseFloat(theory || "0") || 0) + (parseFloat(practical || "0") || 0) + (parseFloat(internal || "0") || 0);
}

function computeMaxTotal(subject: { maxTheoryMarks: string; maxPracticalMarks: string; maxInternalMarks: string }): number {
  return parseFloat(subject.maxTheoryMarks) + parseFloat(subject.maxPracticalMarks) + parseFloat(subject.maxInternalMarks);
}

// ─── GET /exam-marks ───────────────────────────────────────────────────────────
router.get("/exam-marks", requireAuth("admin", "teacher", "parent"), async (req, res) => {
  const { examId, classId, sectionId, subjectId, studentId } = req.query as Record<string, string>;

  const conditions: SQL<unknown>[] = [];
  if (examId) conditions.push(eq(examMarksTable.examId, parseInt(examId, 10)));
  if (classId) conditions.push(eq(examMarksTable.classId, parseInt(classId, 10)));
  if (sectionId) conditions.push(eq(examMarksTable.sectionId, parseInt(sectionId, 10)));
  if (subjectId) conditions.push(eq(examMarksTable.subjectId, parseInt(subjectId, 10)));
  if (studentId) conditions.push(eq(examMarksTable.studentId, parseInt(studentId, 10)));

  if (req.user!.role === "teacher") {
    const assignments = await db
      .select()
      .from(teacherSubjectAssignmentsTable)
      .where(eq(teacherSubjectAssignmentsTable.teacherId, req.user!.id));
    if (assignments.length > 0 && subjectId) {
      const allowed = assignments.map(a => a.subjectId);
      if (!allowed.includes(parseInt(subjectId, 10))) {
        return res.json([]);
      }
    }
  }

  const base = db
    .select({
      id: examMarksTable.id,
      examId: examMarksTable.examId,
      examName: examsTable.name,
      studentId: examMarksTable.studentId,
      studentName: studentsTable.studentName,
      rollNo: studentsTable.rollNo,
      subjectId: examMarksTable.subjectId,
      subjectName: subjectsTable.name,
      subjectCode: subjectsTable.code,
      maxTheoryMarks: subjectsTable.maxTheoryMarks,
      maxPracticalMarks: subjectsTable.maxPracticalMarks,
      maxInternalMarks: subjectsTable.maxInternalMarks,
      classId: examMarksTable.classId,
      className: classesTable.name,
      sectionId: examMarksTable.sectionId,
      sectionName: sectionsTable.name,
      theoryMarks: examMarksTable.theoryMarks,
      practicalMarks: examMarksTable.practicalMarks,
      internalMarks: examMarksTable.internalMarks,
      totalMarks: examMarksTable.totalMarks,
      grade: examMarksTable.grade,
      percentage: examMarksTable.percentage,
      remarks: examMarksTable.remarks,
      isAbsent: examMarksTable.isAbsent,
      isLocked: examMarksTable.isLocked,
      isHeld: examMarksTable.isHeld,
      enteredByTeacherId: examMarksTable.enteredByTeacherId,
      createdAt: examMarksTable.createdAt,
      updatedAt: examMarksTable.updatedAt,
    })
    .from(examMarksTable)
    .leftJoin(examsTable, eq(examMarksTable.examId, examsTable.id))
    .leftJoin(studentsTable, eq(examMarksTable.studentId, studentsTable.id))
    .leftJoin(subjectsTable, eq(examMarksTable.subjectId, subjectsTable.id))
    .leftJoin(classesTable, eq(examMarksTable.classId, classesTable.id))
    .leftJoin(sectionsTable, eq(examMarksTable.sectionId, sectionsTable.id))
    .orderBy(asc(studentsTable.rollNo));

  // Parents cannot see held results
  if (req.user!.role === "parent") {
    conditions.push(eq(examMarksTable.isHeld, false));
  }

  const rows = conditions.length
    ? await base.where(conditions.length === 1 ? conditions[0] : and(...conditions))
    : await base;
  return res.json(rows);
});

// ─── POST /exam-marks ──────────────────────────────────────────────────────────
router.post("/exam-marks", requireAuth("admin", "teacher"), async (req, res) => {
  const { examId, studentId, subjectId, classId, sectionId, theoryMarks, practicalMarks, internalMarks, remarks, isAbsent } = req.body as {
    examId?: number; studentId?: number; subjectId?: number; classId?: number; sectionId?: number;
    theoryMarks?: string; practicalMarks?: string; internalMarks?: string; remarks?: string; isAbsent?: boolean;
  };
  if (!examId || !studentId || !subjectId || !classId) {
    return res.status(400).json({ error: "examId, studentId, subjectId, classId are required" });
  }

  if (req.user!.role === "teacher") {
    const assignments = await db
      .select()
      .from(teacherSubjectAssignmentsTable)
      .where(and(
        eq(teacherSubjectAssignmentsTable.teacherId, req.user!.id),
        eq(teacherSubjectAssignmentsTable.subjectId, subjectId),
        eq(teacherSubjectAssignmentsTable.classId, classId),
      ));
    if (assignments.length === 0) {
      return res.status(403).json({ error: "You are not assigned to teach this subject in this class" });
    }
  }

  const existing = await db
    .select()
    .from(examMarksTable)
    .where(and(
      eq(examMarksTable.examId, examId),
      eq(examMarksTable.studentId, studentId),
      eq(examMarksTable.subjectId, subjectId),
    ));

  if (existing[0]) {
    return res.status(409).json({ error: "Marks already entered for this student/subject/exam. Use PUT to update." });
  }

  const exam = await db.select().from(examsTable).where(eq(examsTable.id, examId));
  if (req.user!.role === "teacher") {
    if (exam[0]?.status !== "active") {
      return res.status(403).json({ error: `Marks entry is only allowed for Active exams. This exam is currently "${exam[0]?.status ?? "unknown"}".` });
    }
  }

  const subjects = await db.select().from(subjectsTable).where(eq(subjectsTable.id, subjectId));
  const subject = subjects[0];

  let totalMarks: string | null = null;
  let percentage: string | null = null;
  let grade = "";

  if (!isAbsent && subject) {
    const total = computeTotal(theoryMarks || null, practicalMarks || null, internalMarks || null);
    const maxTotal = computeMaxTotal(subject);
    totalMarks = total.toString();
    const pct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
    percentage = pct.toFixed(2);
    const gradeInfo = await calcGrade(pct);
    grade = gradeInfo.grade;
  }

  const rows = await db.insert(examMarksTable).values({
    examId, studentId, subjectId, classId, sectionId: sectionId || null,
    theoryMarks: theoryMarks?.toString() || null,
    practicalMarks: practicalMarks?.toString() || null,
    internalMarks: internalMarks?.toString() || null,
    totalMarks, grade, percentage,
    remarks: remarks || "", isAbsent: isAbsent ?? false, isLocked: false,
    enteredByTeacherId: req.user!.role === "teacher" ? req.user!.id : null,
  }).returning();
  return res.status(201).json(rows[0]);
});

// ─── PUT /exam-marks/:id ───────────────────────────────────────────────────────
router.put("/exam-marks/:id", requireAuth("admin", "teacher"), async (req, res) => {
  const id = parseInt(req.params.id as string, 10);

  const existing = await db.select().from(examMarksTable).where(eq(examMarksTable.id, id));
  if (!existing[0]) return res.status(404).json({ error: "Mark entry not found" });
  const mark = existing[0];

  if (mark.isLocked && req.user!.role !== "admin") {
    return res.status(403).json({ error: "Marks are locked and cannot be edited" });
  }

  if (req.user!.role === "teacher") {
    const examRows = await db.select().from(examsTable).where(eq(examsTable.id, mark.examId));
    if (examRows[0]?.status !== "active") {
      return res.status(403).json({ error: `Marks entry is only allowed for Active exams. This exam is "${examRows[0]?.status ?? "unknown"}".` });
    }
    const assignments = await db
      .select()
      .from(teacherSubjectAssignmentsTable)
      .where(and(
        eq(teacherSubjectAssignmentsTable.teacherId, req.user!.id),
        eq(teacherSubjectAssignmentsTable.subjectId, mark.subjectId),
        eq(teacherSubjectAssignmentsTable.classId, mark.classId),
      ));
    if (assignments.length === 0) {
      return res.status(403).json({ error: "You are not assigned to this subject" });
    }
  }

  const { theoryMarks, practicalMarks, internalMarks, remarks, isAbsent, isLocked } = req.body as {
    theoryMarks?: string; practicalMarks?: string; internalMarks?: string;
    remarks?: string; isAbsent?: boolean; isLocked?: boolean;
  };

  await db.insert(marksAuditLogTable).values({
    examMarkId: id,
    changedByRole: req.user!.role,
    changedByTeacherId: req.user!.role === "teacher" ? req.user!.id : null,
    oldTheoryMarks: mark.theoryMarks,
    newTheoryMarks: theoryMarks?.toString() || mark.theoryMarks,
    oldPracticalMarks: mark.practicalMarks,
    newPracticalMarks: practicalMarks?.toString() || mark.practicalMarks,
    reason: req.body.reason || "",
  });

  const subjects = await db.select().from(subjectsTable).where(eq(subjectsTable.id, mark.subjectId));
  const subject = subjects[0];
  const nowAbsent = isAbsent !== undefined ? isAbsent : mark.isAbsent;
  const newTheory = theoryMarks !== undefined ? theoryMarks.toString() : mark.theoryMarks;
  const newPractical = practicalMarks !== undefined ? practicalMarks.toString() : mark.practicalMarks;
  const newInternal = internalMarks !== undefined ? internalMarks.toString() : mark.internalMarks;

  let totalMarks = mark.totalMarks;
  let percentage = mark.percentage;
  let grade = mark.grade;

  if (!nowAbsent && subject) {
    const total = computeTotal(newTheory, newPractical, newInternal);
    const maxTotal = computeMaxTotal(subject);
    totalMarks = total.toString();
    const pct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
    percentage = pct.toFixed(2);
    const gradeInfo = await calcGrade(pct);
    grade = gradeInfo.grade;
  } else if (nowAbsent) {
    totalMarks = null;
    percentage = null;
    grade = "AB";
  }

  const update: Record<string, unknown> = {
    theoryMarks: newTheory, practicalMarks: newPractical, internalMarks: newInternal,
    totalMarks, percentage, grade,
    remarks: remarks !== undefined ? remarks : mark.remarks,
    isAbsent: nowAbsent,
    updatedAt: new Date(),
  };
  if (isLocked !== undefined && req.user!.role === "admin") update.isLocked = isLocked;

  const rows = await db.update(examMarksTable).set(update).where(eq(examMarksTable.id, id)).returning();
  return res.json(rows[0]);
});

// ─── DELETE /exam-marks/:id ────────────────────────────────────────────────────
router.delete("/exam-marks/:id", requireAuth("admin"), async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  await db.delete(examMarksTable).where(eq(examMarksTable.id, id));
  return res.json({ ok: true });
});

// ─── GET /exam-marks/student/:studentId/exam/:examId — full marksheet ─────────
router.get("/exam-marks/student/:studentId/exam/:examId", requireAuth("admin", "teacher", "parent"), async (req, res) => {
  const studentId = parseInt(req.params.studentId as string, 10);
  const examId = parseInt(req.params.examId as string, 10);

  // Parents cannot see held results — check before fetching full marksheet
  if (req.user!.role === "parent") {
    const heldCheck = await db
      .select({ isHeld: examMarksTable.isHeld })
      .from(examMarksTable)
      .where(and(eq(examMarksTable.studentId, studentId), eq(examMarksTable.examId, examId)));
    if (heldCheck.some(m => m.isHeld)) {
      return res.json({ held: true });
    }
  }

  const marks = await db
    .select({
      id: examMarksTable.id,
      subjectId: examMarksTable.subjectId,
      subjectName: subjectsTable.name,
      subjectCode: subjectsTable.code,
      maxTheoryMarks: subjectsTable.maxTheoryMarks,
      maxPracticalMarks: subjectsTable.maxPracticalMarks,
      maxInternalMarks: subjectsTable.maxInternalMarks,
      theoryMarks: examMarksTable.theoryMarks,
      practicalMarks: examMarksTable.practicalMarks,
      internalMarks: examMarksTable.internalMarks,
      totalMarks: examMarksTable.totalMarks,
      grade: examMarksTable.grade,
      percentage: examMarksTable.percentage,
      remarks: examMarksTable.remarks,
      isAbsent: examMarksTable.isAbsent,
      orderIndex: subjectsTable.orderIndex,
    })
    .from(examMarksTable)
    .leftJoin(subjectsTable, eq(examMarksTable.subjectId, subjectsTable.id))
    .where(and(eq(examMarksTable.studentId, studentId), eq(examMarksTable.examId, examId)))
    .orderBy(asc(subjectsTable.orderIndex));

  const [studentRows, examRows] = await Promise.all([
    db.select({
      id: studentsTable.id,
      studentName: studentsTable.studentName,
      rollNo: studentsTable.rollNo,
      fatherName: studentsTable.fatherName,
      motherName: studentsTable.motherName,
      classId: studentsTable.classId,
      sectionId: studentsTable.sectionId,
      className: classesTable.name,
      sectionName: sectionsTable.name,
    })
    .from(studentsTable)
    .leftJoin(classesTable, eq(studentsTable.classId, classesTable.id))
    .leftJoin(sectionsTable, eq(studentsTable.sectionId, sectionsTable.id))
    .where(eq(studentsTable.id, studentId)),
    db.select().from(examsTable).where(eq(examsTable.id, examId)),
  ]);

  const student = studentRows[0] || null;
  const exam = examRows[0] || null;

  const totalObtained = marks.reduce((s, m) => s + (m.isAbsent ? 0 : (parseFloat(m.totalMarks || "0") || 0)), 0);
  const totalMax = marks.reduce((s, m) => {
    const theory = parseFloat(m.maxTheoryMarks || "0");
    const prac = parseFloat(m.maxPracticalMarks || "0");
    const int_ = parseFloat(m.maxInternalMarks || "0");
    return s + theory + prac + int_;
  }, 0);
  const overallPct = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
  const gradeInfo = await calcGrade(overallPct);
  const passPct = exam ? parseFloat(exam.passingPercentage) : 33;
  const failed = marks.some(m => !m.isAbsent && parseFloat(m.percentage || "0") < passPct);
  const passFail = failed ? "fail" : "pass";

  const subjects = marks.map(m => {
    const maxT = parseFloat(m.maxTheoryMarks || "0");
    const maxP = parseFloat(m.maxPracticalMarks || "0");
    const maxI = parseFloat(m.maxInternalMarks || "0");
    const maxSubj = maxT + maxP + maxI;
    return {
      subjectId: m.subjectId,
      subjectName: m.subjectName,
      subjectCode: m.subjectCode,
      theoryMarks: m.theoryMarks,
      practicalMarks: m.practicalMarks,
      internalMarks: m.internalMarks,
      totalMarks: m.totalMarks,
      maxMarks: maxSubj.toString(),
      maxTheoryMarks: m.maxTheoryMarks,
      maxPracticalMarks: m.maxPracticalMarks,
      maxInternalMarks: m.maxInternalMarks,
      grade: m.grade,
      percentage: m.percentage,
      isAbsent: m.isAbsent,
      remarks: m.remarks,
    };
  });

  return res.json({
    exam: { id: exam?.id, name: exam?.name, type: exam?.type, session: exam?.session },
    student: {
      id: student?.id,
      studentName: student?.studentName || "",
      rollNo: student?.rollNo,
      fatherName: student?.fatherName || "",
      motherName: student?.motherName || "",
      className: student?.className || "",
      sectionName: student?.sectionName || "",
    },
    subjects,
    totalMarks: totalObtained.toFixed(0),
    maxMarks: totalMax.toFixed(0),
    percentage: overallPct.toFixed(2),
    grade: gradeInfo.grade,
    gradePoint: gradeInfo.gradePoint,
    passFail,
  });
});

// ─── GET /exam-marks/results/student/:studentId — all exams for a student ─────
router.get("/exam-marks/results/student/:studentId", requireAuth("admin", "teacher", "parent"), async (req, res) => {
  const studentId = parseInt(req.params.studentId as string, 10);

  // Get all published exams
  const publishedExams = await db
    .select()
    .from(examsTable)
    .where(eq(examsTable.status, "published"))
    .orderBy(desc(examsTable.startDate));

  const results = [];

  for (const exam of publishedExams) {
    const marks = await db
      .select({
        subjectId: examMarksTable.subjectId,
        subjectName: subjectsTable.name,
        theoryMarks: examMarksTable.theoryMarks,
        practicalMarks: examMarksTable.practicalMarks,
        internalMarks: examMarksTable.internalMarks,
        totalMarks: examMarksTable.totalMarks,
        maxTheoryMarks: subjectsTable.maxTheoryMarks,
        maxPracticalMarks: subjectsTable.maxPracticalMarks,
        maxInternalMarks: subjectsTable.maxInternalMarks,
        grade: examMarksTable.grade,
        percentage: examMarksTable.percentage,
        isAbsent: examMarksTable.isAbsent,
        isHeld: examMarksTable.isHeld,
      })
      .from(examMarksTable)
      .leftJoin(subjectsTable, eq(examMarksTable.subjectId, subjectsTable.id))
      .where(and(eq(examMarksTable.studentId, studentId), eq(examMarksTable.examId, exam.id)))
      .orderBy(asc(subjectsTable.orderIndex));

    if (marks.length === 0) continue;

    // Parents cannot see held results — skip this exam entirely
    if (req.user!.role === "parent" && marks.some(m => m.isHeld)) continue;

    const totalObtained = marks.reduce((s, m) => s + (m.isAbsent ? 0 : (parseFloat(m.totalMarks || "0") || 0)), 0);
    const totalMax = marks.reduce((s, m) => {
      return s + parseFloat(m.maxTheoryMarks || "0") + parseFloat(m.maxPracticalMarks || "0") + parseFloat(m.maxInternalMarks || "0");
    }, 0);
    const overallPct = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
    const gradeInfo = await calcGrade(overallPct);
    const passPct = parseFloat(exam.passingPercentage) || 33;
    const failed = marks.some(m => !m.isAbsent && parseFloat(m.percentage || "0") < passPct);

    const subjectMarks = marks.map(m => ({
      subjectId: m.subjectId,
      subjectName: m.subjectName,
      theoryMarks: m.theoryMarks,
      practicalMarks: m.practicalMarks,
      internalMarks: m.internalMarks,
      totalMarks: m.totalMarks,
      maxMarks: (parseFloat(m.maxTheoryMarks || "0") + parseFloat(m.maxPracticalMarks || "0") + parseFloat(m.maxInternalMarks || "0")).toString(),
      grade: m.grade,
      percentage: m.percentage,
      isAbsent: m.isAbsent,
    }));

    results.push({
      examId: exam.id,
      examName: exam.name,
      examType: exam.type,
      session: exam.session,
      totalMarks: totalObtained.toFixed(0),
      maxMarks: totalMax.toFixed(0),
      percentage: overallPct.toFixed(2),
      grade: gradeInfo.grade,
      gradePoint: gradeInfo.gradePoint,
      passFail: failed ? "fail" : "pass",
      subjectMarks,
    });
  }

  return res.json(results);
});

// ─── GET /exam-marks/entry-status/:examId — marks submission status per teacher/subject ─
router.get("/exam-marks/entry-status/:examId", requireAuth("admin"), async (req, res) => {
  const examId = parseInt(req.params.examId as string, 10);

  // All teacher-subject assignments (optionally filter by session via exam)
  const assignments = await db
    .select({
      assignmentId: teacherSubjectAssignmentsTable.id,
      teacherId: teacherSubjectAssignmentsTable.teacherId,
      teacherName: teachersTable.name,
      subjectId: teacherSubjectAssignmentsTable.subjectId,
      subjectName: subjectsTable.name,
      classId: teacherSubjectAssignmentsTable.classId,
      className: classesTable.name,
      sectionId: teacherSubjectAssignmentsTable.sectionId,
      sectionName: sectionsTable.name,
      session: teacherSubjectAssignmentsTable.session,
    })
    .from(teacherSubjectAssignmentsTable)
    .leftJoin(teachersTable, eq(teacherSubjectAssignmentsTable.teacherId, teachersTable.id))
    .leftJoin(subjectsTable, eq(teacherSubjectAssignmentsTable.subjectId, subjectsTable.id))
    .leftJoin(classesTable, eq(teacherSubjectAssignmentsTable.classId, classesTable.id))
    .leftJoin(sectionsTable, eq(teacherSubjectAssignmentsTable.sectionId, sectionsTable.id));

  const rows = await Promise.all(assignments.map(async (a) => {
    // Count total students in the class (+ section if specified)
    const studentConditions: SQL<unknown>[] = [eq(studentsTable.classId, a.classId)];
    if (a.sectionId) studentConditions.push(eq(studentsTable.sectionId, a.sectionId));
    const studentRows = await db
      .select({ id: studentsTable.id })
      .from(studentsTable)
      .where(and(...studentConditions));
    const totalStudents = studentRows.length;

    // Count marks entered for this exam + subject + class (+ section if specified)
    const markConditions: SQL<unknown>[] = [
      eq(examMarksTable.examId, examId),
      eq(examMarksTable.subjectId, a.subjectId),
      eq(examMarksTable.classId, a.classId),
    ];
    if (a.sectionId) markConditions.push(eq(examMarksTable.sectionId, a.sectionId));
    const markRows = await db
      .select({ id: examMarksTable.id })
      .from(examMarksTable)
      .where(and(...markConditions));
    const marksEntered = markRows.length;

    const pending = Math.max(0, totalStudents - marksEntered);
    const status = marksEntered === 0 ? "not_started" : marksEntered >= totalStudents ? "complete" : "partial";

    return {
      assignmentId: a.assignmentId,
      teacherId: a.teacherId,
      teacherName: a.teacherName ?? "",
      subjectId: a.subjectId,
      subjectName: a.subjectName ?? "",
      classId: a.classId,
      className: a.className ?? "",
      sectionId: a.sectionId ?? null,
      sectionName: a.sectionName ?? null,
      session: a.session,
      totalStudents,
      marksEntered,
      pending,
      status,
    };
  }));

  return res.json(rows);
});

// ─── GET /exam-marks/results/:examId?classId=&sectionId= — class results / merit list ─
router.get("/exam-marks/results/:examId", requireAuth("admin", "teacher"), async (req, res) => {
  const examId = parseInt(req.params.examId as string, 10);
  const { classId, sectionId } = req.query as Record<string, string>;

  if (!classId) return res.status(400).json({ error: "classId is required" });

  const conditions: SQL<unknown>[] = [
    eq(examMarksTable.examId, examId),
    eq(examMarksTable.classId, parseInt(classId, 10)),
  ];
  if (sectionId) conditions.push(eq(examMarksTable.sectionId, parseInt(sectionId, 10)));

  const allMarks = await db
    .select({
      studentId: examMarksTable.studentId,
      studentName: studentsTable.studentName,
      rollNo: studentsTable.rollNo,
      fatherName: studentsTable.fatherName,
      sectionId: examMarksTable.sectionId,
      sectionName: sectionsTable.name,
      subjectId: examMarksTable.subjectId,
      subjectName: subjectsTable.name,
      orderIndex: subjectsTable.orderIndex,
      maxTheoryMarks: subjectsTable.maxTheoryMarks,
      maxPracticalMarks: subjectsTable.maxPracticalMarks,
      maxInternalMarks: subjectsTable.maxInternalMarks,
      theoryMarks: examMarksTable.theoryMarks,
      practicalMarks: examMarksTable.practicalMarks,
      internalMarks: examMarksTable.internalMarks,
      totalMarks: examMarksTable.totalMarks,
      grade: examMarksTable.grade,
      percentage: examMarksTable.percentage,
      isAbsent: examMarksTable.isAbsent,
    })
    .from(examMarksTable)
    .leftJoin(studentsTable, eq(examMarksTable.studentId, studentsTable.id))
    .leftJoin(subjectsTable, eq(examMarksTable.subjectId, subjectsTable.id))
    .leftJoin(sectionsTable, eq(examMarksTable.sectionId, sectionsTable.id))
    .where(and(...conditions))
    .orderBy(asc(studentsTable.rollNo), asc(subjectsTable.orderIndex));

  const studentMap = new Map<number, {
    studentId: number; studentName: string; rollNo: number; fatherName: string;
    sectionName: string | null; subjects: typeof allMarks;
  }>();

  for (const row of allMarks) {
    if (!studentMap.has(row.studentId)) {
      studentMap.set(row.studentId, {
        studentId: row.studentId, studentName: row.studentName || "",
        rollNo: row.rollNo || 0, fatherName: row.fatherName || "",
        sectionName: row.sectionName, subjects: [],
      });
    }
    studentMap.get(row.studentId)!.subjects.push(row);
  }

  const passingPct = 33;
  const exam = await db.select().from(examsTable).where(eq(examsTable.id, examId));
  const passPct = exam[0] ? parseFloat(exam[0].passingPercentage) : passingPct;
  const className = await db.select().from(classesTable).where(eq(classesTable.id, parseInt(classId, 10)));

  const results = await Promise.all([...studentMap.values()].map(async s => {
    const totalObtained = s.subjects.reduce((sum, m) => sum + (m.isAbsent ? 0 : (parseFloat(m.totalMarks || "0") || 0)), 0);
    const totalMax = s.subjects.reduce((sum, m) => {
      return sum + parseFloat(m.maxTheoryMarks || "0") + parseFloat(m.maxPracticalMarks || "0") + parseFloat(m.maxInternalMarks || "0");
    }, 0);
    const overallPct = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
    const failed = s.subjects.some(m => !m.isAbsent && parseFloat(m.percentage || "0") < passPct);
    const gradeInfo = await calcGrade(overallPct);
    return {
      ...s, totalObtained: totalObtained.toFixed(2), totalMax: totalMax.toFixed(2),
      overallPercentage: overallPct.toFixed(2), result: failed ? "FAIL" : "PASS",
      grade: gradeInfo.grade, gradePoint: gradeInfo.gradePoint,
    };
  }));

  const sorted = [...results].sort((a, b) => parseFloat(b.overallPercentage) - parseFloat(a.overallPercentage));
  sorted.forEach((r, i) => { (r as Record<string, unknown>).rank = i + 1; });

  return res.json({ exam: exam[0] || null, className: className[0]?.name || "", results: sorted });
});

// ─── POST /exam-marks/bulk — save multiple marks at once ──────────────────────
router.post("/exam-marks/bulk", requireAuth("admin", "teacher"), async (req, res) => {
  const { marks } = req.body as {
    marks?: Array<{
      examId: number; studentId: number; subjectId: number; classId: number; sectionId?: number;
      theoryMarks?: string; practicalMarks?: string; internalMarks?: string; remarks?: string; isAbsent?: boolean;
    }>;
  };
  if (!Array.isArray(marks) || marks.length === 0) return res.status(400).json({ error: "marks array is required" });

  // Teachers can only save marks for Active exams
  if (req.user!.role === "teacher" && marks.length > 0) {
    const firstExamId = marks[0].examId;
    const examRows = await db.select().from(examsTable).where(eq(examsTable.id, firstExamId));
    if (examRows[0]?.status !== "active") {
      return res.status(403).json({
        error: `Marks entry is only allowed for Active exams. This exam is currently "${examRows[0]?.status ?? "unknown"}".`,
      });
    }
  }

  const results = [];
  for (const m of marks) {
    const { examId, studentId, subjectId, classId, sectionId, theoryMarks, practicalMarks, internalMarks, remarks, isAbsent } = m;

    const subjects = await db.select().from(subjectsTable).where(eq(subjectsTable.id, subjectId));
    const subject = subjects[0];
    const nowAbsent = isAbsent ?? false;

    let totalMarks: string | null = null;
    let percentage: string | null = null;
    let grade = "";

    if (!nowAbsent && subject) {
      const total = computeTotal(theoryMarks || null, practicalMarks || null, internalMarks || null);
      const maxTotal = computeMaxTotal(subject);
      totalMarks = total.toString();
      const pct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
      percentage = pct.toFixed(2);
      const gradeInfo = await calcGrade(pct);
      grade = gradeInfo.grade;
    }

    const existing = await db
      .select()
      .from(examMarksTable)
      .where(and(eq(examMarksTable.examId, examId), eq(examMarksTable.studentId, studentId), eq(examMarksTable.subjectId, subjectId)));

    if (existing[0]) {
      if (existing[0].isLocked && req.user!.role !== "admin") continue;
      const updated = await db.update(examMarksTable).set({
        theoryMarks: theoryMarks?.toString() || null,
        practicalMarks: practicalMarks?.toString() || null,
        internalMarks: internalMarks?.toString() || null,
        totalMarks, percentage, grade,
        remarks: remarks || "", isAbsent: nowAbsent,
        updatedAt: new Date(),
      }).where(eq(examMarksTable.id, existing[0].id)).returning();
      results.push(updated[0]);
    } else {
      const inserted = await db.insert(examMarksTable).values({
        examId, studentId, subjectId, classId, sectionId: sectionId || null,
        theoryMarks: theoryMarks?.toString() || null,
        practicalMarks: practicalMarks?.toString() || null,
        internalMarks: internalMarks?.toString() || null,
        totalMarks, percentage, grade,
        remarks: remarks || "", isAbsent: nowAbsent, isLocked: false,
        enteredByTeacherId: req.user!.role === "teacher" ? req.user!.id : null,
      }).returning();
      results.push(inserted[0]);
    }
  }
  return res.json({ saved: results.length, results });
});

// ─── POST /exam-marks/bulk-hold — admin holds/releases results for parents ────
router.post("/exam-marks/bulk-hold", requireAuth("admin"), async (req, res) => {
  const { examId, studentIds, isHeld } = req.body as {
    examId?: number;
    studentIds?: number[];
    isHeld?: boolean;
  };
  if (!examId || !Array.isArray(studentIds) || studentIds.length === 0) {
    return res.status(400).json({ error: "examId and studentIds are required" });
  }
  const holdVal = isHeld ?? true;
  let updated = 0;
  for (const studentId of studentIds) {
    const result = await db
      .update(examMarksTable)
      .set({ isHeld: holdVal, updatedAt: new Date() })
      .where(and(eq(examMarksTable.examId, examId), eq(examMarksTable.studentId, studentId)));
    updated += (result as any).rowCount ?? 0;
  }
  return res.json({ ok: true, updated, isHeld: holdVal });
});

// ─── GET /exam-marks/audit/:examMarkId — audit trail ─────────────────────────
router.get("/exam-marks/audit/:examMarkId", requireAuth("admin"), async (req, res) => {
  const examMarkId = parseInt(req.params.examMarkId as string, 10);
  const rows = await db
    .select()
    .from(marksAuditLogTable)
    .where(eq(marksAuditLogTable.examMarkId, examMarkId));
  return res.json(rows);
});

export default router;
