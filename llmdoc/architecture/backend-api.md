# Architecture of Backend API

## 1. Identity

- **What it is:** A Hono-based REST API server providing authentication, skill registry, and namespace management for Skillhub.
- **Purpose:** Serves as the central backend for the Skillhub platform, handling user auth (JWT + Device Code flow), skill artifact storage (S3), and RBAC-based access control.

## 2. Core Components

- `packages/backend/src/index.ts` (`app`): Hono app entry point. Registers global middleware (cors, logger), mounts 4 route prefixes, registers error/404 handlers, starts HTTP server via `@hono/node-server`.
- `packages/backend/src/env.ts` (`getEnv`, `Env`): Zod-validated environment config singleton. Required: `DATABASE_URL`, `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `JWT_SECRET`, `PORT`, `NODE_ENV`. Exits on validation failure.
- `packages/backend/src/db.ts` (`getDb`, `closeDb`): Singleton drizzle-orm + postgres.js database client.
- `packages/backend/src/middleware/auth.ts` (`requireAuth`, `requireRole`, `requireNsRole`): Three RBAC middleware layers -- global auth, global role check, and namespace-scoped role check. Admin role bypasses all checks.
- `packages/backend/src/utils/jwt.ts` (`signJwt`, `verifyJwt`, `JwtPayload`): HS256 JWT using `jose` library. Payload: `sub` (userId), `username`, `role`. Default expiry: 7 days.
- `packages/backend/src/routes/auth.ts` (`authRoutes`): Auth routes -- register, device code flow (3 endpoints), `/me`.
- `packages/backend/src/routes/skills.ts` (`skillsRoutes`): Skill CRUD routes. Push has inline namespace permission check; delete uses `requireNsRole`.
- `packages/backend/src/routes/namespaces.ts` (`namespaceRoutes`): Namespace and member management. Directly operates on DB (no service layer).
- `packages/backend/src/routes/health.ts` (`healthRoutes`): Health check probing DB (`SELECT 1`) and S3 connectivity.
- `packages/backend/src/services/auth.service.ts`: User registration (argon2), authentication, Device Code lifecycle, `getUserById`.
- `packages/backend/src/services/skill.service.ts`: Skill upsert, query, search (ilike), delete (cascades S3 cleanup), download counting.
- `packages/backend/src/services/storage.service.ts`: Singleton S3Client wrapper (`forcePathStyle: true` for MinIO). Provides upload/download/signedUrl/delete/exists/healthCheck.
- `packages/backend/src/services/audit.service.ts` (`logAuditEvent`, `queryAuditLogs`): Fire-and-forget audit log writes; query with action/userId/time-range filters.
- `packages/backend/src/models/schema.ts`: Runtime schema re-exports from individual model files (user, namespace, skill, device-code, audit-log).

## 3. Execution Flow (LLM Retrieval Map)

### Request Lifecycle

- **1. Entry:** HTTP request hits Hono app in `packages/backend/src/index.ts:11-27`.
- **2. Global Middleware:** `cors()` then `logger()` applied to all routes (`index.ts:14-15`).
- **3. Routing:** Dispatched to one of 4 route groups: `/health`, `/api/auth`, `/api/skills`, `/api/namespaces` (`index.ts:24-27`).
- **4. Auth Middleware:** Protected routes invoke `requireAuth` (`middleware/auth.ts:11-25`) which extracts Bearer token and calls `verifyJwt` (`utils/jwt.ts:22-25`), storing `JwtPayload` in Hono context.
- **5. RBAC Middleware:** Namespace-scoped routes invoke `requireNsRole` (`middleware/auth.ts:38-67`) which queries `ns_members` table for role verification. Admin bypasses at line 44.
- **6. Route Handler:** Delegates to service layer (auth.service, skill.service) or direct DB operations (namespace routes).
- **7. Error Handling:** Unhandled errors caught by `app.onError` (`index.ts:18-21`), returning 500. Unmatched routes return 404 (`index.ts:30-32`).

### Skill Push Flow

- **1.** `POST /api/skills/:ns/:name` hits `routes/skills.ts:14-84`.
- **2.** Inline namespace permission check queries `namespaces` + `ns_members` tables (`skills.ts:21-33`).
- **3.** Parses multipart or raw binary body, validates size <= 50MB (`skills.ts:35-55`).
- **4.** Computes SHA-256 checksum (`skills.ts:57`).
- **5.** Calls `skill.service.ts:7-76` (`createOrUpdateSkill`): upserts skill record, uploads to S3 via `storage.service.ts:23-31`, upserts skill_tag record.
- **6.** Writes audit log via `audit.service.ts:5-15` (`skills.ts:63-70`).

## 4. Design Rationale

- **Singleton pattern** for DB, S3Client, and env to avoid repeated initialization.
- **Namespace routes skip service layer** -- direct DB operations since logic is simple CRUD.
- **Skill push inlines RBAC** instead of using `requireNsRole` middleware because it needs the namespace record for subsequent operations.
- **Device Code token endpoint returns HTTP 200 for errors** to comply with OAuth 2.0 Device Authorization Grant spec.
- **S3 `forcePathStyle: true`** enables MinIO compatibility for local development.
