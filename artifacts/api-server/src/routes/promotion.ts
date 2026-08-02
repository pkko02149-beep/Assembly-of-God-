import { Router } from "express";
import {
  pool, db, globalDb, academicSessionsTable, teachersTable,
  teacherPromotionConfigsTable, teacherPromotionPermissionsTable,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth-middleware";
import { logger } from "../lib/logger";

const router = Router();

// School year months in order: April → March
const SCHOOL_MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];

/**
 * Compute month-wise balance due for a student in a given schema.
 * Replicates the exact same logic as fees-tab.tsx monthRows calculation.
 *
 * Returns: { monthlyDues: Record<string, number>, totalDue: number }
 *   where keys are month numbers as strings ("4", "5", …) and values are rupee amounts.
 */
export async function computeMonthlyDues(
  client: any,
  schema: string,
  student: any,
  sessionName: string,
): Promise<{ monthlyDues: Record<string, number>; totalDue: number }> {
  // Extract base year from session name e.g. "2026-2027" → 2026
  const baseYear = parseInt(sessionName.split("-")[0] ?? "0", 10);

  const studentType = (student.student_type ?? "").toLowerCase();
  const isRTE = studentType.includes("rte");
  const isNew = studentType.includes("new");

  // Run all DB lookups in parallel for speed
  const [structResult, paymentsResult, paidCategoryResult, transportResult] = await Promise.all([
    // All fee structures for this class (we filter by name below)
    client.query(
      `SELECT fc.id AS category_id, fc.name AS category_name, fc.frequency, fs.amount
       FROM "${schema}".fee_structures fs
       JOIN "${schema}".fee_categories fc ON fc.id = fs.category_id
       WHERE fs.class_id = $1`,
      [student.class_id],
    ),
    // Monthly payments already made (for balance calc)
    client.query(
      `SELECT "month", year, COALESCE(SUM(paid_amount), 0) AS paid_total
       FROM "${schema}".fee_payments
       WHERE student_id = $1
         AND is_previous_due = false
         AND "month" > 0
       GROUP BY "month", year`,
      [student.id],
    ),
    // Distinct paid categories (to check one-time fees)
    client.query(
      `SELECT DISTINCT category_id
       FROM "${schema}".fee_payments
       WHERE student_id = $1 AND is_previous_due = false`,
      [student.id],
    ),
    // Transport route price — transport_routes is session-specific, so query the
    // correct session schema (not public) to get the right price for that year.
    student.transport_route_id
      ? client.query(
          `SELECT price_per_month FROM "${schema}".transport_routes WHERE id = $1`,
          [student.transport_route_id],
        )
      : Promise.resolve({ rows: [] }),
  ]);

  // ── 1. Fee structures: mirror fees-tab tuitionStructs filter ──────────────
  // fees-tab excludes categories whose name contains "transport", "bus", or "admission"
  // and handles admission separately (only for "New" students).
  const tuitionStructs: { categoryId: number; frequency: string; amount: number }[] =
    structResult.rows
      .filter((r: any) => {
        const cn = (r.category_name ?? "").toLowerCase();
        return !cn.includes("transport") && !cn.includes("bus") && !cn.includes("admission");
      })
      .map((r: any) => ({
        categoryId: r.category_id,
        frequency: (r.frequency || "monthly").toLowerCase(),
        amount: parseFloat(r.amount ?? "0"),
      }));

  // ── 2. Admission fee — only for "New" students (mirrors fees-tab isNew guard) ──
  const paidCategoryIds = new Set<number>(
    paidCategoryResult.rows.map((r: any) => r.category_id as number),
  );
  let admissionFeeAmount = 0;
  if (isNew) {
    const admRow = structResult.rows.find((r: any) =>
      (r.category_name ?? "").toLowerCase().includes("admission"),
    );
    if (admRow) {
      const admCatId = admRow.category_id as number;
      if (!paidCategoryIds.has(admCatId)) {
        admissionFeeAmount = parseFloat(admRow.amount ?? "0");
      }
    }
  }

  // ── 3. Transport ───────────────────────────────────────────────────────────
  let transportAmount = 0;
  if (transportResult.rows.length > 0) {
    transportAmount = parseFloat(transportResult.rows[0].price_per_month ?? "0");
  }
  const transportFromMonth: number = student.transport_from_month ?? 4;
  const transportStopMonth: number | null = student.transport_stop_month ?? null;

  // ── 4. Build paid-per-month map ────────────────────────────────────────────
  const paidMap: Record<string, number> = {};
  for (const row of paymentsResult.rows) {
    const key = `${row.month}-${row.year}`;
    paidMap[key] = parseFloat(row.paid_total ?? "0");
  }

  // ── 5. Active months ───────────────────────────────────────────────────────
  let startIdx = 0;
  if (!student.fee_from_april && student.admission_date) {
    const parts = String(student.admission_date).split("-");
    const admMonth = parseInt(parts[1] ?? "0", 10);
    const idx = SCHOOL_MONTHS.indexOf(admMonth);
    if (idx > 0) startIdx = idx;
  }
  const activeMonths = SCHOOL_MONTHS.slice(startIdx);

  // ── 6. Calculate balance per month ────────────────────────────────────────
  const monthlyDues: Record<string, number> = {};
  let totalDue = 0;

  for (let i = 0; i < activeMonths.length; i++) {
    const m = activeMonths[i];
    const mYear = m >= 4 ? baseYear : baseYear + 1;
    const schoolYearIdx = SCHOOL_MONTHS.indexOf(m); // 0=Apr … 11=Mar

    let monthDue = 0;

    if (!isRTE) {
      // Regular tuition (monthly/quarterly/annual) — transport & admission excluded above
      for (const s of tuitionStructs) {
        const freq = s.frequency;
        if (freq === "monthly") {
          monthDue += s.amount;
        } else if (freq === "quarterly" && schoolYearIdx % 3 === 0) {
          monthDue += s.amount;
        } else if (freq === "annually" && schoolYearIdx === 0) {
          monthDue += s.amount;
        }
        // "one-time" non-admission fees: skip — they were excluded from tuitionStructs
        // (admission is handled separately below via admissionFeeAmount)
      }

      // Admission fee in the first active month (only for New students, only if unpaid)
      if (i === 0 && admissionFeeAmount > 0) {
        monthDue += admissionFeeAmount;
      }

      // Transport fee (mirrors fees-tab: fromIdx check + optional stop)
      if (transportAmount > 0) {
        const fromIdx = SCHOOL_MONTHS.indexOf(transportFromMonth);
        const mIdx = SCHOOL_MONTHS.indexOf(m);
        if (fromIdx >= 0 && mIdx >= fromIdx) {
          if (transportStopMonth !== null) {
            const stopIdx = SCHOOL_MONTHS.indexOf(transportStopMonth);
            if (stopIdx >= 0 && mIdx < stopIdx) monthDue += transportAmount;
          } else {
            monthDue += transportAmount;
          }
        }
      }
    }

    if (monthDue <= 0) continue;

    const paidTotal = paidMap[`${m}-${mYear}`] ?? 0;
    const balance = Math.max(0, Math.round((monthDue - paidTotal) * 100) / 100);

    if (balance > 0) {
      monthlyDues[String(m)] = (monthlyDues[String(m)] ?? 0) + balance;
      totalDue += balance;
    }
  }

  return { monthlyDues, totalDue };
}

type PromotionConfigRow = typeof teacherPromotionConfigsTable.$inferSelect;

function configEnd(config: PromotionConfigRow): Date {
  return new Date(config.windowOpenedAt.getTime() + config.windowHours * 60 * 60 * 1000);
}

async function getTeacherPromotionContext(teacherId: number) {
  const [sourceSession] = await globalDb.select().from(academicSessionsTable)
    .where(eq(academicSessionsTable.isCurrent, true));
  if (!sourceSession) return { reason: "No current academic session is configured" as const };

  const [config] = await globalDb.select().from(teacherPromotionConfigsTable)
    .where(eq(teacherPromotionConfigsTable.sourceSessionId, sourceSession.id));
  const [teacher] = await db.select({
    id: teachersTable.id,
    name: teachersTable.name,
    classAssigned: teachersTable.classAssigned,
    sectionAssigned: teachersTable.sectionAssigned,
  }).from(teachersTable).where(eq(teachersTable.id, teacherId));

  if (!teacher) return { reason: "Teacher account is not available in the current session" as const };
  if (!teacher.classAssigned) return { reason: "A class must be assigned to this teacher" as const, teacher, sourceSession };
  if (!config) return { reason: "The school administrator has not configured the teacher promotion window" as const, teacher, sourceSession };

  const [permission] = await globalDb.select({ id: teacherPromotionPermissionsTable.id })
    .from(teacherPromotionPermissionsTable)
    .where(and(
      eq(teacherPromotionPermissionsTable.configId, config.id),
      eq(teacherPromotionPermissionsTable.teacherId, teacherId),
    ));
  const windowEndsAt = configEnd(config);
  if (!permission) return { reason: "Your teacher promotion permission has not been granted" as const, teacher, sourceSession, config, windowEndsAt };
  if (windowEndsAt.getTime() < Date.now()) {
    return { reason: "The teacher promotion window is closed" as const, teacher, sourceSession, config, windowEndsAt };
  }

  const [targetSession] = await globalDb.select().from(academicSessionsTable)
    .where(eq(academicSessionsTable.id, config.targetSessionId));
  if (!targetSession) return { reason: "The configured target academic session no longer exists" as const, teacher, sourceSession, config, windowEndsAt };
  return { teacher, sourceSession, targetSession, config, windowEndsAt, authorized: true as const };
}

function promotionConfigPayload(config: PromotionConfigRow, sourceSession: any, targetSession: any, teacherIds: number[]) {
  return {
    ...config,
    windowOpenedAt: config.windowOpenedAt.toISOString(),
    windowEndsAt: configEnd(config).toISOString(),
    sourceSession,
    targetSession,
    teacherIds,
  };
}

// Admin configuration for the teacher-facing workflow.
router.get("/teacher-promotion/config", requireAuth("admin"), async (req, res) => {
  const requestedSource = req.query.sourceSessionId ? Number(req.query.sourceSessionId) : undefined;
  const sessions = await globalDb.select().from(academicSessionsTable);
  const sourceSession = sessions.find(s => s.id === requestedSource)
    ?? sessions.find(s => s.isCurrent);
  if (!sourceSession) return res.json({ config: null, sourceSession: null, targetSession: null, teachers: [] });

  const [config] = await globalDb.select().from(teacherPromotionConfigsTable)
    .where(eq(teacherPromotionConfigsTable.sourceSessionId, sourceSession.id));
  const targetSession = config ? sessions.find(s => s.id === config.targetSessionId) ?? null : null;
  const permissionRows = config
    ? await globalDb.select({ teacherId: teacherPromotionPermissionsTable.teacherId })
      .from(teacherPromotionPermissionsTable)
      .where(eq(teacherPromotionPermissionsTable.configId, config.id))
    : [];

  const client = await pool.connect();
  try {
    const teacherRows = await client.query(
      `SELECT id, employee_id AS "employeeId", name, class_assigned AS "classAssigned",
              section_assigned AS "sectionAssigned"
         FROM "${sourceSession.schemaName}".teachers
        ORDER BY name`,
    );
    return res.json({
      config: config && targetSession
        ? promotionConfigPayload(config, sourceSession, targetSession, permissionRows.map(r => r.teacherId))
        : null,
      sourceSession,
      targetSession,
      teachers: teacherRows.rows,
    });
  } finally {
    client.release();
  }
});

router.put("/teacher-promotion/config", requireAuth("admin"), async (req, res) => {
  const sourceSessionId = Number(req.body?.sourceSessionId);
  const targetSessionId = Number(req.body?.targetSessionId);
  const windowHours = Number(req.body?.windowHours);
  const teacherIds = Array.isArray(req.body?.teacherIds)
    ? [...new Set(req.body.teacherIds.map(Number).filter((id: number) => Number.isInteger(id) && id > 0))]
    : [];
  if (!Number.isInteger(sourceSessionId) || !Number.isInteger(targetSessionId) || sourceSessionId === targetSessionId) {
    return res.status(400).json({ error: "Choose different source and target sessions" });
  }
  if (!Number.isInteger(windowHours) || windowHours < 1 || windowHours > 8760) {
    return res.status(400).json({ error: "Window duration must be between 1 and 8760 hours" });
  }

  const sessions = await globalDb.select().from(academicSessionsTable);
  const sourceSession = sessions.find(s => s.id === sourceSessionId);
  const targetSession = sessions.find(s => s.id === targetSessionId);
  if (!sourceSession || !targetSession) return res.status(404).json({ error: "Session not found" });

  const client = await pool.connect();
  try {
    const validTeacherResult = await client.query(
      `SELECT id FROM "${sourceSession.schemaName}".teachers WHERE id = ANY($1::int[])`,
      [teacherIds],
    );
    const validTeacherIds = validTeacherResult.rows.map((r: { id: number }) => Number(r.id));
    const [existing] = await globalDb.select().from(teacherPromotionConfigsTable)
      .where(eq(teacherPromotionConfigsTable.sourceSessionId, sourceSessionId));
    const config = existing
      ? (await globalDb.update(teacherPromotionConfigsTable).set({
          targetSessionId,
          windowHours,
          windowOpenedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(teacherPromotionConfigsTable.id, existing.id)).returning())[0]
      : (await globalDb.insert(teacherPromotionConfigsTable).values({
          sourceSessionId, targetSessionId, windowHours, windowOpenedAt: new Date(),
        }).returning())[0];

    await globalDb.delete(teacherPromotionPermissionsTable)
      .where(eq(teacherPromotionPermissionsTable.configId, config.id));
    if (validTeacherIds.length) {
      await globalDb.insert(teacherPromotionPermissionsTable).values(
        validTeacherIds.map(teacherId => ({ configId: config.id, teacherId })),
      );
    }
    return res.json(promotionConfigPayload(config, sourceSession, targetSession, validTeacherIds));
  } finally {
    client.release();
  }
});

// Teacher status is deliberately separate from the admin configuration response:
// it never exposes another teacher's permission list.
router.get("/teacher-promotion/status", requireAuth("teacher"), async (req, res) => {
  const context = await getTeacherPromotionContext(req.user!.id);
  const authorized = "authorized" in context && context.authorized === true;
  return res.json({
    authorized,
    reason: authorized ? null : context.reason,
    teacher: context.teacher ?? null,
    sourceSession: context.sourceSession ?? null,
    targetSession: context.targetSession ?? null,
    windowOpenedAt: context.config?.windowOpenedAt?.toISOString() ?? null,
    windowEndsAt: context.windowEndsAt?.toISOString() ?? null,
  });
});

/** Get students from a specific session schema filtered by class/section */
router.get(
  "/academic-sessions/promote/students",
  requireAuth("admin", "teacher"),
  async (req, res) => {
    let { fromSessionId, toSessionId, classId, sectionId } = req.query;

    if (req.user!.role === "teacher") {
      const context = await getTeacherPromotionContext(req.user!.id);
      if (!("authorized" in context) || !context.authorized) {
        res.status(403).json({ error: context.reason });
        return;
      }
      // Never trust teacher-supplied session/class filters. These values are
      // derived from the active configuration and the authenticated account.
      fromSessionId = String(context.sourceSession.id);
      toSessionId = String(context.targetSession.id);
      classId = String(context.teacher.classAssigned);
      // A class teacher may review every student in the assigned class.
      // The teacher's own assigned section is not a student filter.
      sectionId = undefined;
    }

    if (!fromSessionId) {
      res.status(400).json({ error: "fromSessionId is required" });
      return;
    }

    const sessionId = parseInt(fromSessionId as string, 10);
    if (isNaN(sessionId)) {
      res.status(400).json({ error: "Invalid fromSessionId" });
      return;
    }

    const toSessionIdNum = toSessionId ? parseInt(toSessionId as string, 10) : null;

    // Resolve from-session (and optionally to-session) in parallel
    const sessionQueries: Promise<any[]>[] = [
      globalDb.select().from(academicSessionsTable).where(eq(academicSessionsTable.id, sessionId)),
    ];
    if (toSessionIdNum && !isNaN(toSessionIdNum)) {
      sessionQueries.push(
        globalDb.select().from(academicSessionsTable).where(eq(academicSessionsTable.id, toSessionIdNum)),
      );
    }
    const [fromSessions, toSessions = []] = await Promise.all(sessionQueries);

    if (fromSessions.length === 0) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const schema = fromSessions[0].schemaName;
    const sessionName = fromSessions[0].name;
    const toSchema = toSessions[0]?.schemaName ?? null;

    const client = await pool.connect();

    try {
      const conditions: string[] = [];
      const params: (string | number)[] = [];

      if (classId && !isNaN(parseInt(classId as string, 10))) {
        params.push(parseInt(classId as string, 10));
        conditions.push(`s.class_id = $${params.length}`);
      }
      if (sectionId && !isNaN(parseInt(sectionId as string, 10))) {
        params.push(parseInt(sectionId as string, 10));
        conditions.push(`s.section_id = $${params.length}`);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const studentsResult = await client.query(
        `SELECT
           s.id, s.unique_id, s.roll_no, s.student_name, s.father_name, s.mother_name,
           s.class_id, s.section_id, s.whatsapp_number, s.photo_url,
           s.session, s.previous_year_due, s.previous_year_due_remarks,
           s.fee_from_april, s.transport_from_month, s.transport_stop_month,
           s.has_vehicle, s.has_trip, s.vehicle_id, s.trip_id, s.transport_route_id, s.transport_months,
           s.admission_date, s.date_of_birth, s.gender, s.category, s.student_type, s.is_promoted,
           s.aadhar_number, s.pan_number, s.nationality, s.blood_group, s.religion,
           s.address, s.parent_email, s.previous_school, s.emergency_contact,
           c.name AS class_name,
           sec.name AS section_name
         FROM "${schema}".students s
         LEFT JOIN public.classes c ON c.id = s.class_id
         LEFT JOIN public.sections sec ON sec.id = s.section_id
         ${where}
         ORDER BY s.class_id, s.roll_no`,
        params,
      );

      // Build a map of unique_id → class_id for students already in the target session.
      // This lets us determine whether a promoted student was actually promoted (new class)
      // or detained (same class) without an extra query per student.
      const targetStudentMap = new Map<string, number>(); // unique_id → class_id
      if (toSchema) {
        try {
          const targetResult = await client.query(
            `SELECT unique_id, class_id FROM "${toSchema}".students`,
          );
          for (const row of targetResult.rows) {
            if (row.unique_id) targetStudentMap.set(row.unique_id, row.class_id);
          }
        } catch {
          // Target schema may not exist yet — that's fine, map stays empty
        }
      }

      // For preview: show total pending due per student using the correct calculation
      const studentRows = studentsResult.rows;

      // Batch-fetch how much of each student's previous-year due has already been paid
      // via fee_payments records where is_previous_due = true.
      const prevDuePaidMap = new Map<number, number>();
      if (studentRows.length > 0) {
        const prevDuePaidResult = await client.query(
          `SELECT student_id, COALESCE(SUM(paid_amount), 0) AS paid_total
           FROM "${schema}".fee_payments
           WHERE is_previous_due = true
           GROUP BY student_id`,
        );
        for (const row of prevDuePaidResult.rows) {
          prevDuePaidMap.set(Number(row.student_id), parseFloat(row.paid_total ?? "0"));
        }
      }

      const students = await Promise.all(
        studentRows.map(async (r: any) => {
          const { totalDue } = await computeMonthlyDues(client, schema, r, sessionName);

          // Determine whether this student was already actioned in a previous promotion run.
          // Priority: "dropped" in student_type → drop; is_promoted=true → promote or detain.
          let alreadyAction: "promote" | "detain" | "drop" | null = null;
          const typeLower = (r.student_type ?? "").toLowerCase();
          if (typeLower.includes("dropped")) {
            alreadyAction = "drop";
          } else if (r.is_promoted) {
            // Check the target session to distinguish promoted (different class) vs detained (same class)
            if (targetStudentMap.has(r.unique_id)) {
              const targetClassId = targetStudentMap.get(r.unique_id)!;
              alreadyAction = targetClassId === r.class_id ? "detain" : "promote";
            } else {
              // is_promoted=true but not found in target yet — treat as promoted (shouldn't normally happen)
              alreadyAction = "promote";
            }
          }

          return {
            id: r.id,
            uniqueId: r.unique_id,
            rollNo: r.roll_no,
            studentName: r.student_name,
            fatherName: r.father_name,
            motherName: r.mother_name,
            classId: r.class_id,
            sectionId: r.section_id,
            className: r.class_name,
            sectionName: r.section_name,
            whatsappNumber: r.whatsapp_number,
            photoUrl: r.photo_url,
            session: r.session,
            studentType: r.student_type,
            isPromoted: r.is_promoted ?? false,
            alreadyAction,
            gender: r.gender,
            previousYearDue: Math.max(0, parseFloat(r.previous_year_due ?? "0") - (prevDuePaidMap.get(Number(r.id)) ?? 0)),
            pendingFeeDue: totalDue,
          };
        }),
      );

      res.json(students);
    } finally {
      client.release();
    }
  },
);

/** Execute the year-end promotion for a batch of students */
router.post(
  "/academic-sessions/promote",
  requireAuth("admin", "teacher"),
  async (req, res) => {
    let { fromSessionId, toSessionId, decisions } = req.body as {
      fromSessionId: number;
      toSessionId: number;
      decisions: Array<{
        studentId: number;
        action: "promote" | "detain" | "drop";
        toClassId?: number;
        toSectionId?: number;
      }>;
    };

    if (!Array.isArray(decisions) || decisions.length === 0) {
      res.status(400).json({ error: "decisions[] is required and cannot be empty" });
      return;
    }

    let teacherContext: Awaited<ReturnType<typeof getTeacherPromotionContext>> | null = null;
    if (req.user!.role === "teacher") {
      teacherContext = await getTeacherPromotionContext(req.user!.id);
      if (!("authorized" in teacherContext) || !teacherContext.authorized) {
        res.status(403).json({ error: teacherContext.reason });
        return;
      }
      fromSessionId = teacherContext.sourceSession.id;
      toSessionId = teacherContext.targetSession.id;
      const client = await pool.connect();
      try {
        const classResult = await client.query(
          `SELECT id FROM public.classes ORDER BY id`,
        );
        const classIds = classResult.rows.map((row: { id: number }) => Number(row.id));
        const assignedClass = Number(teacherContext.teacher.classAssigned);
        const assignedClassIndex = classIds.indexOf(assignedClass);
        const nextClassId = assignedClassIndex >= 0 ? classIds[assignedClassIndex + 1] : undefined;
        const sectionResult = await client.query(
          `SELECT id, class_id FROM public.sections`,
        );
        const sectionClassById = new Map<number, number | null>(
          sectionResult.rows.map((row: { id: number; class_id: number | null }) => [Number(row.id), row.class_id == null ? null : Number(row.class_id)]),
        );

        // The teacher may only act on students in their assigned class. The
        // target class is derived from the class ordering, never accepted from
        // the client; only the target section is editable.
        for (const decision of decisions) {
          if (!["promote", "detain", "drop"].includes(decision.action)) {
            res.status(400).json({ error: "Invalid promotion action" });
            return;
          }
          const targetSectionClass = decision.toSectionId == null
            ? null
            : sectionClassById.get(Number(decision.toSectionId));
          if (decision.toSectionId != null && targetSectionClass === undefined) {
            res.status(400).json({ error: "Invalid target section" });
            return;
          }
          const expectedSectionClass = decision.action === "promote"
            ? nextClassId
            : decision.action === "detain"
              ? assignedClass
              : null;
          if (decision.toSectionId != null && targetSectionClass !== null &&
              targetSectionClass !== expectedSectionClass) {
            res.status(400).json({ error: "Target section does not belong to the assigned or target class" });
            return;
          }
          if (decision.action === "promote" && !nextClassId) {
            res.status(400).json({ error: "There is no next class configured for promotion" });
            return;
          }
          if (decision.toClassId != null && decision.toClassId !== nextClassId && decision.action === "promote") {
            res.status(400).json({ error: "Target class is fixed by the school configuration" });
            return;
          }
          if (decision.action === "detain" && decision.toClassId != null && decision.toClassId !== assignedClass) {
            res.status(400).json({ error: "Detained students remain in their current class" });
            return;
          }
          decision.toClassId = decision.action === "promote" ? nextClassId : assignedClass;
        }
        const ids = decisions.map(d => Number(d.studentId)).filter(Number.isInteger);
        if (ids.length !== decisions.length || new Set(ids).size !== ids.length) {
          res.status(400).json({ error: "Each student decision must have a unique studentId" });
          return;
        }
        const sourceStudentResult = await client.query(
          `SELECT id, class_id, section_id
             FROM "${teacherContext.sourceSession.schemaName}".students
            WHERE id = ANY($1::int[])`,
          [ids],
        );
        for (const student of sourceStudentResult.rows) {
          if (Number(student.class_id) !== assignedClass) {
            res.status(403).json({ error: "You can only submit students from your assigned class" });
            return;
          }
        }
        if (sourceStudentResult.rows.length !== ids.length) {
          res.status(400).json({ error: "One or more students were not found in your assigned class" });
          return;
        }
      } finally {
        client.release();
      }
    }

    if (!fromSessionId || !toSessionId) {
      res.status(400).json({ error: "fromSessionId, toSessionId and decisions[] are required" });
      return;
    }

    const [fromSessions, toSessions] = await Promise.all([
      globalDb.select().from(academicSessionsTable).where(eq(academicSessionsTable.id, fromSessionId)),
      globalDb.select().from(academicSessionsTable).where(eq(academicSessionsTable.id, toSessionId)),
    ]);

    if (fromSessions.length === 0) {
      res.status(404).json({ error: "Source session not found" });
      return;
    }
    if (toSessions.length === 0) {
      res.status(404).json({ error: "Target session not found" });
      return;
    }

    const fromSession = fromSessions[0];
    const toSession = toSessions[0];
    const fromSchema = fromSession.schemaName;
    const toSchema = toSession.schemaName;

    const client = await pool.connect();
    const results: Array<{ studentId: number; action: string; status: string; error?: string }> = [];

    try {
      await client.query("BEGIN");

      for (const decision of decisions) {
        const { studentId, action, toClassId, toSectionId } = decision;

        try {
          if (action === "drop") {
            // Preserve original type in the label so fee logic stays correct:
            // "New" → "New/Dropped", "Old" → "Old/Dropped", "RTE" → "RTE/Dropped"
            const origRes = await client.query(
              `SELECT student_type FROM "${fromSchema}".students WHERE id = $1`,
              [studentId],
            );
            const origType = origRes.rows[0]?.student_type ?? "Old";
            const newType = origType.toLowerCase().includes("dropped")
              ? origType
              : `${origType}/Dropped`;
            await client.query(
              `UPDATE "${fromSchema}".students SET student_type = $1 WHERE id = $2`,
              [newType, studentId],
            );
            results.push({ studentId, action, status: "ok" });
            continue;
          }

          // Fetch full student record from source schema
          const studentResult = await client.query(
            `SELECT * FROM "${fromSchema}".students WHERE id = $1`,
            [studentId],
          );

          if (studentResult.rows.length === 0) {
            results.push({ studentId, action, status: "error", error: "Student not found in source session" });
            continue;
          }

          const s = studentResult.rows[0];

          // ── Correct balance calculation: fee_structures − actually paid ──
          const { monthlyDues, totalDue: pendingDue } = await computeMonthlyDues(
            client, fromSchema, s, fromSession.name,
          );

          // ── Block promote/detain when the student has unpaid PREVIOUS-YEAR due ──
          // Only the NET remaining previous-year due (original amount minus any
          // payments recorded with is_previous_due = true) blocks promotion.
          // Current-session monthly dues do NOT block it.
          // Dropped students are never blocked.
          const rawPrevDue = parseFloat(s.previous_year_due ?? "0");
          let prevDuePaid = 0;
          if (rawPrevDue > 0) {
            const prevPaidRes = await client.query(
              `SELECT COALESCE(SUM(paid_amount), 0) AS paid_total
               FROM "${fromSchema}".fee_payments
               WHERE student_id = $1 AND is_previous_due = true`,
              [studentId],
            );
            prevDuePaid = parseFloat(prevPaidRes.rows[0]?.paid_total ?? "0");
          }
          const prevDueAmt = Math.max(0, rawPrevDue - prevDuePaid);
          if (prevDueAmt > 0) {
            results.push({
              studentId,
              action,
              status: "error",
              error: `Student has ₹${prevDueAmt.toFixed(0)} in unpaid previous-year dues. Clear that balance before promoting or detaining.`,
            });
            continue;
          }

          // ── Merge with any existing monthly JSON on the student record ──
          // (e.g. from a prior year that was already stored as monthly breakdown)
          let existingMonthly: Record<string, number> = {};
          try {
            const raw = (s.previous_year_due_remarks ?? "").trim();
            if (raw.startsWith("{")) {
              const parsed = JSON.parse(raw) as Record<string, number>;
              for (const [k, v] of Object.entries(parsed)) {
                const amt = parseFloat(String(v));
                if (!isNaN(amt) && amt > 0) existingMonthly[k] = amt;
              }
            }
          } catch { /* ignore */ }

          // Merge: prior-year existing + this session's per-month dues
          const mergedMonthly: Record<string, number> = { ...existingMonthly };
          for (const [month, due] of Object.entries(monthlyDues)) {
            if (due > 0) {
              mergedMonthly[month] = (mergedMonthly[month] ?? 0) + due;
            }
          }

          const carriedForwardDue = Object.values(mergedMonthly).reduce((a, b) => a + b, 0);
          const remarksText = Object.keys(mergedMonthly).length > 0
            ? JSON.stringify(mergedMonthly)
            : "";

          const targetClassId = action === "detain" ? s.class_id : (toClassId ?? s.class_id);
          const targetSectionId = toSectionId ?? s.section_id;

          // Derive the base student type by stripping any prior action suffix
          // e.g. "New/Promoted" → "New", "Old/Detained" → "Old", "RTE" → "RTE"
          const baseType = ((s.student_type ?? "Old").split("/")[0]).trim() || "Old";
          const newStudentType = action === "promote" ? `${baseType}/Promoted` : `${baseType}/Detained`;

          // ── Resolve transport route into the target schema ─────────────────
          // Transport routes are session-specific (separate table per schema).
          // The source student's transport_route_id only exists in fromSchema,
          // so we must find-or-create the same route in toSchema by name.
          // This keeps prices independent: editing a route in one session never
          // touches the other session's copy.
          let targetTransportRouteId: number | null = null;
          if (s.transport_route_id != null) {
            const srcRouteResult = await client.query(
              `SELECT id, name, price_per_month FROM "${fromSchema}".transport_routes WHERE id = $1`,
              [s.transport_route_id],
            );
            if (srcRouteResult.rows.length > 0) {
              const { name: routeName, price_per_month: routePrice } = srcRouteResult.rows[0];
              // Check if a same-named route already exists in the target schema
              const tgtRouteResult = await client.query(
                `SELECT id FROM "${toSchema}".transport_routes WHERE LOWER(name) = LOWER($1)`,
                [routeName],
              );
              if (tgtRouteResult.rows.length > 0) {
                targetTransportRouteId = tgtRouteResult.rows[0].id as number;
              } else {
                // Create an independent copy in the target schema
                const newRouteResult = await client.query(
                  `INSERT INTO "${toSchema}".transport_routes (name, price_per_month, created_at)
                   VALUES ($1, $2, NOW()) RETURNING id`,
                  [routeName, routePrice],
                );
                targetTransportRouteId = newRouteResult.rows[0].id as number;
              }
            }
            // If source route was deleted, targetTransportRouteId stays null — transport cleared
          }

          // ── Resolve vehicle into the target schema ─────────────────────────
          // Vehicles are session-specific. Copy by name (find-or-create) so
          // edits in one session never affect the other session's vehicle list.
          let targetVehicleId: number | null = null;
          if (s.vehicle_id != null) {
            const srcVehicleResult = await client.query(
              `SELECT id, name FROM "${fromSchema}".vehicles WHERE id = $1`,
              [s.vehicle_id],
            );
            if (srcVehicleResult.rows.length > 0) {
              const { name: vehicleName } = srcVehicleResult.rows[0];
              const tgtVehicleResult = await client.query(
                `SELECT id FROM "${toSchema}".vehicles WHERE LOWER(name) = LOWER($1)`,
                [vehicleName],
              );
              if (tgtVehicleResult.rows.length > 0) {
                targetVehicleId = tgtVehicleResult.rows[0].id as number;
              } else {
                const newVehicleResult = await client.query(
                  `INSERT INTO "${toSchema}".vehicles (name) VALUES ($1) RETURNING id`,
                  [vehicleName],
                );
                targetVehicleId = newVehicleResult.rows[0].id as number;
              }
            }
            // If source vehicle was deleted, targetVehicleId stays null
          }

          // ── Resolve trip into the target schema ────────────────────────────
          // Trips are session-specific. Copy by name (find-or-create) so
          // edits in one session never affect the other session's trip list.
          let targetTripId: number | null = null;
          if (s.trip_id != null) {
            const srcTripResult = await client.query(
              `SELECT id, name FROM "${fromSchema}".trips WHERE id = $1`,
              [s.trip_id],
            );
            if (srcTripResult.rows.length > 0) {
              const { name: tripName } = srcTripResult.rows[0];
              const tgtTripResult = await client.query(
                `SELECT id FROM "${toSchema}".trips WHERE LOWER(name) = LOWER($1)`,
                [tripName],
              );
              if (tgtTripResult.rows.length > 0) {
                targetTripId = tgtTripResult.rows[0].id as number;
              } else {
                const newTripResult = await client.query(
                  `INSERT INTO "${toSchema}".trips (name) VALUES ($1) RETURNING id`,
                  [tripName],
                );
                targetTripId = newTripResult.rows[0].id as number;
              }
            }
            // If source trip was deleted, targetTripId stays null
          }

          // Check if student already exists in target schema
          const existingResult = await client.query(
            `SELECT id, previous_year_due_remarks FROM "${toSchema}".students WHERE unique_id = $1`,
            [s.unique_id],
          );

          if (existingResult.rows.length > 0) {
            // Student already there — UPDATE their monthly dues
            const existingStudent = existingResult.rows[0];
            let alreadyExisting: Record<string, number> = {};
            try {
              const raw = (existingStudent.previous_year_due_remarks ?? "").trim();
              if (raw.startsWith("{")) {
                const parsed = JSON.parse(raw) as Record<string, number>;
                for (const [k, v] of Object.entries(parsed)) {
                  const amt = parseFloat(String(v));
                  if (!isNaN(amt) && amt > 0) alreadyExisting[k] = amt;
                }
              }
            } catch { /* ignore */ }

            // Use the freshly computed monthly dues (overwrite stale data)
            const updatedMonthly = { ...alreadyExisting };
            for (const [month, due] of Object.entries(monthlyDues)) {
              if (due > 0) updatedMonthly[month] = due;
            }
            const updatedTotal = Object.values(updatedMonthly).reduce((a, b) => a + b, 0);
            const updatedRemarks = Object.keys(updatedMonthly).length > 0
              ? JSON.stringify(updatedMonthly)
              : "";

            await client.query(
              `UPDATE "${toSchema}".students
               SET previous_year_due = $1, previous_year_due_remarks = $2,
                   transport_route_id = $4, student_type = $5,
                   vehicle_id = $6, trip_id = $7,
                   has_vehicle = $8, has_trip = $9,
                   transport_from_month = 4,
                   transport_stop_month = NULL
               WHERE id = $3`,
              // Keep the base type in the target session. In particular,
              // "New" must remain "New" so the target FIR includes the
              // one-time April admission fee. Action badges belong only to
              // the source-session record below.
              // Transport stop is session-specific: always reset has_vehicle/has_trip
              // based on whether a vehicle/trip is assigned, and clear the stop month
              // so the student starts the new academic year with a clean transport slate.
              [
                updatedTotal.toFixed(2),
                updatedRemarks,
                existingStudent.id,
                targetTransportRouteId,
                baseType,
                targetVehicleId,
                targetTripId,
                targetVehicleId != null,  // has_vehicle: active if vehicle resolved in target schema
                targetTripId != null,     // has_trip: active if trip resolved in target schema
              ],
            );

            // Copy parent links from old student record to the existing session's student record
            await client.query(
              `INSERT INTO student_parent (student_id, parent_id)
               SELECT $1, sp.parent_id
               FROM student_parent sp
               WHERE sp.student_id = $2
                 AND NOT EXISTS (
                   SELECT 1 FROM student_parent sp2
                   WHERE sp2.student_id = $1 AND sp2.parent_id = sp.parent_id
                 )`,
              [existingStudent.id, studentId],
            );

            // Mark source student as promoted and stamp the action badge on their type
            // e.g. "New" → "New/Promoted", "Old" → "Old/Detained", "RTE" → "RTE/Promoted"
            await client.query(
              `UPDATE "${fromSchema}".students SET is_promoted = true, student_type = $2 WHERE id = $1`,
              [studentId, newStudentType],
            );
            results.push({ studentId, action, status: "updated" });
            continue;
          }

          // New student — INSERT into target schema, capture new id for parent link copy
          const insertResult = await client.query(
            `INSERT INTO "${toSchema}".students (
               unique_id, roll_no, student_name, father_name, mother_name,
               class_id, section_id, whatsapp_number, parent_email, address,
               has_vehicle, has_trip, vehicle_id, trip_id, transport_route_id,
               transport_months, photo_url, admission_date, date_of_birth,
               aadhar_number, pan_number, gender, previous_school, student_type,
               fee_from_april, transport_from_month, transport_stop_month,
               session, previous_year_due, previous_year_due_remarks,
               category, religion, blood_group, nationality, emergency_contact,
               created_at
             ) VALUES (
               $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
               $11,$12,$13,$14,$15,$16,$17,$18,$19,
               $20,$21,$22,$23,$24,$25,$26,$27,
               $28,$29,$30,$31,$32,$33,$34,$35,
               NOW()
             ) RETURNING id`,
            [
              s.unique_id,
              s.roll_no,
              s.student_name,
              s.father_name,
              s.mother_name,
              targetClassId,
              targetSectionId,
              s.whatsapp_number,
              s.parent_email,
              s.address,
              // Transport stop is session-specific — reset for the new year.
              // Vehicle and trip are resolved by name into the target schema so
              // edits in one session never affect another session's records.
              targetVehicleId != null,  // has_vehicle: true if vehicle resolved in target schema
              targetTripId != null,     // has_trip: true if trip resolved in target schema
              targetVehicleId,
              targetTripId,
              targetTransportRouteId,
              s.transport_months,
              s.photo_url,
              s.admission_date,
              s.date_of_birth,
              s.aadhar_number,
              s.pan_number,
              s.gender,
              s.previous_school,
              baseType,
              s.fee_from_april,
              4,    // transport_from_month: always reset to April (new year starts fresh)
              null, // transport_stop_month: cleared — stop only applied in source session
              toSession.name,
              carriedForwardDue.toFixed(2),
              remarksText,
              s.category,
              s.religion,
              s.blood_group,
              s.nationality,
              s.emergency_contact,
            ],
          );

          // Copy parent links from old student record to the new session's student record
          const newStudentId = insertResult.rows[0]?.id;
          if (newStudentId) {
            await client.query(
              `INSERT INTO student_parent (student_id, parent_id)
               SELECT $1, sp.parent_id
               FROM student_parent sp
               WHERE sp.student_id = $2
                 AND NOT EXISTS (
                   SELECT 1 FROM student_parent sp2
                   WHERE sp2.student_id = $1 AND sp2.parent_id = sp.parent_id
                 )`,
              [newStudentId, studentId],
            );
          }

          // Mark source student as promoted and stamp the action badge on their type
          // e.g. "New" → "New/Promoted", "Old" → "Old/Detained", "RTE" → "RTE/Promoted"
          await client.query(
            `UPDATE "${fromSchema}".students SET is_promoted = true, student_type = $2 WHERE id = $1`,
            [studentId, newStudentType],
          );

          results.push({ studentId, action, status: "ok" });
        } catch (err: any) {
          logger.warn({ err: err.message, studentId, action }, "Promotion decision failed");
          results.push({ studentId, action, status: "error", error: err.message });
        }
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      logger.error({ err }, "Promotion transaction failed");
      res.status(500).json({ error: "Promotion failed — transaction rolled back" });
      return;
    } finally {
      client.release();
    }

    const succeeded = results.filter((r) => r.status === "ok" || r.status === "updated").length;
    const failed = results.filter((r) => r.status === "error").length;

    logger.info(
      { fromSession: fromSession.name, toSession: toSession.name, succeeded, failed },
      "Year-end promotion completed",
    );

    res.json({ ok: true, succeeded, skipped: 0, failed, results });
  },
);

/**
 * Recalculate and sync previousYearDue for all already-promoted students.
 * Use this to fix stale values that were stored before a calculation bug was patched.
 */
router.post(
  "/academic-sessions/recalculate-dues",
  requireAuth("admin"),
  async (req, res) => {
    const { fromSessionId, toSessionId } = req.body as {
      fromSessionId: number;
      toSessionId: number;
    };

    if (!fromSessionId || !toSessionId) {
      res.status(400).json({ error: "fromSessionId and toSessionId are required" });
      return;
    }

    const [fromSessions, toSessions] = await Promise.all([
      globalDb.select().from(academicSessionsTable).where(eq(academicSessionsTable.id, fromSessionId)),
      globalDb.select().from(academicSessionsTable).where(eq(academicSessionsTable.id, toSessionId)),
    ]);

    if (!fromSessions.length || !toSessions.length) {
      res.status(404).json({ error: "One or both sessions not found" });
      return;
    }

    const fromSchema = fromSessions[0].schemaName;
    const toSchema = toSessions[0].schemaName;
    const fromSessionName = fromSessions[0].name;

    const client = await pool.connect();
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    try {
      // Fetch all students from source session (promoted or detained)
      const promotedResult = await client.query(
        `SELECT * FROM "${fromSchema}".students WHERE is_promoted = true OR student_type = 'Detained'`,
      );

      for (const s of promotedResult.rows) {
        try {
          // Recompute correct monthly dues from source session
          const { monthlyDues, totalDue } = await computeMonthlyDues(
            client, fromSchema, s, fromSessionName,
          );

          if (totalDue <= 0) {
            skipped++;
            continue;
          }

          // Find matching student in target session by unique_id
          const targetResult = await client.query(
            `SELECT id, previous_year_due_remarks FROM "${toSchema}".students WHERE unique_id = $1`,
            [s.unique_id],
          );

          if (!targetResult.rows.length) {
            skipped++;
            continue;
          }

          const target = targetResult.rows[0];

          // Build fresh monthly remarks — overwrite old stale per-month values
          // but preserve any months from an even earlier session that aren't in monthlyDues
          let existing: Record<string, number> = {};
          try {
            const raw = (target.previous_year_due_remarks ?? "").trim();
            if (raw.startsWith("{")) {
              const parsed = JSON.parse(raw) as Record<string, number>;
              for (const [k, v] of Object.entries(parsed)) {
                const amt = parseFloat(String(v));
                if (!isNaN(amt) && amt > 0) existing[k] = amt;
              }
            }
          } catch { /* ignore */ }

          const merged: Record<string, number> = { ...existing };
          for (const [month, due] of Object.entries(monthlyDues)) {
            if (due > 0) merged[month] = due; // overwrite stale
          }
          const newTotal = Object.values(merged).reduce((a, b) => a + b, 0);
          const newRemarks = Object.keys(merged).length > 0 ? JSON.stringify(merged) : "";

          await client.query(
            `UPDATE "${toSchema}".students
             SET previous_year_due = $1, previous_year_due_remarks = $2
             WHERE id = $3`,
            [newTotal.toFixed(2), newRemarks, target.id],
          );
          updated++;
        } catch (err: any) {
          errors.push(`${s.student_name}: ${err.message}`);
        }
      }

      logger.info(
        { fromSchema, toSchema, updated, skipped, errors: errors.length },
        "Previous year due recalculation complete",
      );

      res.json({ ok: true, updated, skipped, errors });
    } finally {
      client.release();
    }
  },
);

export default router;
