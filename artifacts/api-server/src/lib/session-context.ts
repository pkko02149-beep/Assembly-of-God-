import { globalDb, academicSessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

let _currentSchemaName: string | null = null;
let _currentSessionName: string | null = null;

/** Called once at startup to read the current session from DB. */
export async function loadCurrentSession(): Promise<void> {
  try {
    const rows = await globalDb
      .select()
      .from(academicSessionsTable)
      .where(eq(academicSessionsTable.isCurrent, true));

    if (rows.length > 0) {
      _currentSchemaName = rows[0].schemaName;
      _currentSessionName = rows[0].name;
      logger.info({ schema: _currentSchemaName, session: _currentSessionName }, "Current academic session loaded");
    } else {
      _currentSchemaName = null;
      _currentSessionName = null;
      logger.info("No current academic session set — queries will use public schema");
    }
  } catch (err) {
    logger.error({ err }, "Failed to load current academic session (table may not exist yet)");
    _currentSchemaName = null;
    _currentSessionName = null;
  }
}

export function getCurrentSchemaName(): string | null {
  return _currentSchemaName;
}

export function getCurrentSessionName(): string | null {
  return _currentSessionName;
}

export function setCurrentSession(schemaName: string, sessionName: string): void {
  _currentSchemaName = schemaName;
  _currentSessionName = sessionName;
  logger.info({ schema: schemaName, session: sessionName }, "Current academic session updated");
}

export function clearCurrentSession(): void {
  _currentSchemaName = null;
  _currentSessionName = null;
}
