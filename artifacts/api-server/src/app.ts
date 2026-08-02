import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { loadCurrentSession, getCurrentSchemaName } from "./lib/session-context";
import { migrateExistingSessionSchemas } from "./routes/academic-sessions";
import { runWithSession } from "@workspace/db";

const app: Express = express();

// Load the current academic session at startup, then backfill any new
// session-specific tables into schemas that were created before this migration.
loadCurrentSession();
migrateExistingSessionSchemas();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Academic session middleware ────────────────────────────────────────────────
// Routes all Drizzle `db` calls to the correct session's PostgreSQL schema.
// Priority: X-Session-Schema request header (used by the parent portal to route
// to the schema of the student's own academic year) → global current session.
app.use((req, _res, next) => {
  const headerSchema = (req.headers["x-session-schema"] as string | undefined)?.trim();
  const schemaName = headerSchema || getCurrentSchemaName();
  if (schemaName) {
    runWithSession(schemaName, next);
  } else {
    next();
  }
});

app.use("/api", router);

// ── Global JSON error handler ─────────────────────────────────────────────────
// Catches any unhandled error thrown in route handlers and returns JSON instead
// of Express's default HTML error page, which breaks all API clients.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "Unhandled route error");
  const status = (err as any).status || (err as any).statusCode || 500;
  res.status(status).json({ error: err.message || "Internal server error" });
});

export default app;
