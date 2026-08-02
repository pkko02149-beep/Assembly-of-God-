import { AsyncLocalStorage } from "async_hooks";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// ── Global pool — always hits public schema ────────────────────────────────────
const globalPool = new Pool({ connectionString: process.env.DATABASE_URL });
export const globalDb = drizzle(globalPool, { schema });

// ── Per-session pools and db instances (one per schema, cached) ───────────────
const _sessionPools = new Map<string, pg.Pool>();
const _sessionDbs = new Map<string, NodePgDatabase<typeof schema>>();

function getSessionDb(schemaName: string): NodePgDatabase<typeof schema> {
  if (!_sessionDbs.has(schemaName)) {
    const p = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
    // Set search_path on every new connection in this pool
    p.on("connect", (client) => {
      client.query(`SET search_path TO "${schemaName}", public`).catch(() => {});
    });
    _sessionPools.set(schemaName, p);
    _sessionDbs.set(schemaName, drizzle(p, { schema }));
  }
  return _sessionDbs.get(schemaName)!;
}

// ── AsyncLocalStorage: stores the active session db for the current request ───
const _als = new AsyncLocalStorage<NodePgDatabase<typeof schema>>();

/**
 * `db` proxy: transparently routes all Drizzle calls to the current
 * session's schema when inside a `runWithSession()` context, otherwise
 * falls back to globalDb (public schema).
 *
 * Zero changes required in existing route files — they just import `db`
 * as before and automatically get the right schema per request.
 */
export const db = new Proxy(globalDb, {
  get(_target, prop) {
    const ctx = _als.getStore();
    const active = ctx ?? globalDb;
    const val = (active as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof val === "function") return (val as (...args: unknown[]) => unknown).bind(active);
    return val;
  },
}) as NodePgDatabase<typeof schema>;

/**
 * Run `fn` (an Express `next()` call or similar) inside the AsyncLocalStorage
 * context for `schemaName`. All `db` accesses within the async call chain of
 * `fn` will automatically use the session-specific schema.
 */
export function runWithSession(schemaName: string, fn: () => void): void {
  _als.run(getSessionDb(schemaName), fn);
}

// Export the global pool so the academic-sessions route can create new schemas
export const pool = globalPool;

export * from "./schema";
