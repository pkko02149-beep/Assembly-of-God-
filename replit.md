# School Management System

A full-featured school management system with a public-facing website, admin panel, teacher portal, and parent portal.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/school-mgmt run dev` — run the frontend (port assigned by workflow)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, TailwindCSS, shadcn/ui, Wouter (routing), TanStack Query
- API: Express 5
- DB: PostgreSQL + Drizzle ORM (multi-schema: one schema per academic session)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/school-mgmt/src/pages/` — all page components
  - `admin/` — admin panel (dashboard, students, fees, attendance, exams, etc.)
  - `teacher/` — teacher portal (homework, marks, timetable, etc.)
  - `parent/` — parent portal (child info, fees, attendance, leave requests)
  - Public pages: home, about, admission, academics, gallery, notices, downloads, contact
- `artifacts/api-server/src/routes/` — Express route handlers (one file per domain)
- `lib/db/src/schema/index.ts` — single source of truth for DB schema (Drizzle)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contracts)
- `lib/api-client-react/src/generated/` — generated React Query hooks (do not edit)
- `lib/api-zod/src/generated/` — generated Zod schemas for server validation (do not edit)

## Architecture decisions

- **Multi-schema DB**: Each academic session gets its own PostgreSQL schema (e.g. `y2026_2027`). An AsyncLocalStorage context in `lib/db/src/index.ts` transparently routes `db` calls to the correct schema per request.
- **Session routing via header**: The `x-session-schema` request header lets the parent portal query a specific academic year's data without changing the global session.
- **Contract-first API**: OpenAPI spec drives codegen; never write types by hand that codegen produces.
- **JWT auth for admin/teacher/parent** with bcrypt password hashing; no third-party auth service.

## Product

- **Public website**: Homepage with slider, notices, gallery, toppers, downloads, admission enquiry, contact
- **Admin portal**: Student records, fee management (Razorpay integration), attendance, exams & marks, homework, timetable, teacher management, academic sessions, website CMS, audit logs
- **Teacher portal**: Mark entry, homework assignment, attendance, leave requests, timetable view
- **Parent portal**: Child info, fee payments, attendance history, homework, leave requests, notices

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `pnpm run dev` at workspace root won't work — run individual artifacts via their managed workflows.
- After any schema change in `lib/db/src/schema/index.ts`, run `pnpm --filter @workspace/db run push` to apply to dev DB.
- After any OpenAPI spec change, run `pnpm --filter @workspace/api-spec run codegen` before touching the frontend.
- The API server build step is part of `dev` script — it compiles with esbuild before starting.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
