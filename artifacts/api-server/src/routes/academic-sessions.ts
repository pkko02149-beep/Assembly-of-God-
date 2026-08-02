import { Router } from "express";
import { eq } from "drizzle-orm";
import { globalDb, pool, academicSessionsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth-middleware";
import { setCurrentSession } from "../lib/session-context";
import { logger } from "../lib/logger";

const router = Router();

// Tables that are session-specific — created fresh in every new academic schema.
// Global tables (app_settings, staff_users, classes, teachers, parents, etc.)
// stay in the public schema and are automatically shared across all sessions.
const SESSION_TABLES = [
  "students",
  "attendance",
  "expenditures",
  "fee_categories",
  "fee_structures",
  "fee_payments",
  "homework",
  "student_marks",
  "marks_audit_log",
  "teacher_mark_approvals",
  "leave_requests",
  "notices",
  "periods",
  "timetable",
  "subjects",
  "exams",
  "exam_schedules",
  "exam_marks",
  "grading_rules",
  "teacher_subject_assignments",
  "fir_records",
  "admit_card_holds",
  "audit_logs",
  // Transport data is session-specific: each year has its own routes, vehicles,
  // trips and pricing — no bleed-through between academic years.
  "transport_routes",
  "vehicles",
  "trips",
  // Teachers are session-specific: only teachers added within an academic session
  // are visible in that session. Prevents bleed-over between years.
  "teachers",
  // Teacher-uploaded subject documents are per-academic-year.
  "teacher_documents",
];

async function createSessionSchema(schemaName: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    for (const table of SESSION_TABLES) {
      // LIKE ... INCLUDING DEFAULTS copies column types + serial defaults.
      // NOT INCLUDING INDEXES keeps creation fast; indexes can be added later.
      await client.query(
        `CREATE TABLE IF NOT EXISTS "${schemaName}"."${table}"
         (LIKE public."${table}" INCLUDING DEFAULTS INCLUDING CONSTRAINTS)`,
      );
    }
    logger.info({ schemaName }, "Academic session schema created");
  } finally {
    client.release();
  }
}

/**
 * Backfill migration: ensure every existing session schema has all tables in
 * SESSION_TABLES. Safe to run on every startup — uses CREATE TABLE IF NOT EXISTS.
 * Needed when new tables are added to SESSION_TABLES after schemas already exist.
 *
 * Also runs column-level backfills for columns added after the initial schema
 * was created (e.g. is_promoted added to students).
 */
export async function migrateExistingSessionSchemas(): Promise<void> {
  const client = await pool.connect();
  try {
    const sessions = await globalDb.select().from(academicSessionsTable);
    for (const session of sessions) {
      // Ensure all session-specific tables exist
      for (const table of SESSION_TABLES) {
        await client.query(
          `CREATE TABLE IF NOT EXISTS "${session.schemaName}"."${table}"
           (LIKE public."${table}" INCLUDING DEFAULTS INCLUDING CONSTRAINTS)`,
        );
      }

      // Column backfills — safe to run repeatedly (ADD COLUMN IF NOT EXISTS)
      // is_promoted: tracks promotion without overwriting the original student_type
      await client.query(
        `ALTER TABLE "${session.schemaName}".students
         ADD COLUMN IF NOT EXISTS is_promoted boolean NOT NULL DEFAULT false`,
      );

      logger.info({ schemaName: session.schemaName }, "Session schema migration complete");
    }
  } catch (err) {
    logger.warn({ err }, "Session schema migration skipped (tables may not exist yet)");
  } finally {
    client.release();
  }
}

// ── GET /api/academic-sessions/status  (public — used by frontend on login) ──
router.get("/academic-sessions/status", async (_req, res) => {
  try {
    const sessions = await globalDb
      .select()
      .from(academicSessionsTable)
      .orderBy(academicSessionsTable.yearStart);
    const current = sessions.find((s) => s.isCurrent) ?? null;
    res.json({ hasSessions: sessions.length > 0, currentSession: current, sessions });
  } catch {
    // Table may not exist on very first boot before push
    res.json({ hasSessions: false, currentSession: null, sessions: [] });
  }
});

// ── GET /api/academic-sessions  (admin) ───────────────────────────────────────
router.get("/academic-sessions", requireAuth("admin"), async (_req, res) => {
  const sessions = await globalDb
    .select()
    .from(academicSessionsTable)
    .orderBy(academicSessionsTable.yearStart);
  res.json(sessions);
});

// ── POST /api/academic-sessions  (admin) ─────────────────────────────────────
router.post("/academic-sessions", requireAuth("admin"), async (req, res) => {
  const { yearStart, yearEnd } = req.body as { yearStart: number | string; yearEnd: number | string };

  const ys = Number(yearStart);
  const ye = Number(yearEnd);

  if (!ys || !ye || ye !== ys + 1) {
    res.status(400).json({ error: "yearEnd must be yearStart + 1 (e.g. 2026 → 2027)" });
    return;
  }

  const name = `${ys}-${ye}`;
  const schemaName = `y${ys}_${ye}`;

  // Prevent duplicates
  const existing = await globalDb
    .select()
    .from(academicSessionsTable)
    .where(eq(academicSessionsTable.schemaName, schemaName));
  if (existing.length > 0) {
    res.status(400).json({ error: `Session ${name} already exists` });
    return;
  }

  // Auto-set as current if it's the very first session
  const all = await globalDb.select().from(academicSessionsTable);
  const firstSession = all.length === 0;

  // Create the PostgreSQL schema + tables
  await createSessionSchema(schemaName);

  // If first session, unset any stale current flags (defensive)
  if (firstSession) {
    await globalDb
      .update(academicSessionsTable)
      .set({ isCurrent: false })
      .where(eq(academicSessionsTable.isCurrent, true));
  }

  const [session] = await globalDb
    .insert(academicSessionsTable)
    .values({ name, yearStart: ys, yearEnd: ye, schemaName, isCurrent: firstSession })
    .returning();

  if (firstSession) {
    setCurrentSession(schemaName, name);
  }

  res.json(session);
});

// ── PUT /api/academic-sessions/:id/set-current  (admin) ──────────────────────
router.put("/academic-sessions/:id/set-current", requireAuth("admin"), async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  // Unset all current flags first
  await globalDb.update(academicSessionsTable).set({ isCurrent: false });

  // Set the requested session as current
  const [session] = await globalDb
    .update(academicSessionsTable)
    .set({ isCurrent: true })
    .where(eq(academicSessionsTable.id, id))
    .returning();

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  setCurrentSession(session.schemaName, session.name);

  res.json({ ok: true, session });
});

export default router;
