# Architecture of Backend API

## 1. Identity

- **What it is:** A Hono-based REST API server providing authentication, skill registry, and namespace management for Skillr.
- **Purpose:** Serves as the central backend for the Skillr platform, handling user auth (JWT + Device Code + API Key), skill artifact storage (S3/R2), and RBAC-based access control. Supports dual deployment: Node.js (Docker) and Cloudflare Workers (D1 + R2).

## 2. Core Components

- `packages/backend/src/index.ts` (`app`): Hono app definition. Registers global middleware (cors, logger), mounts 7 route prefixes, registers error/404 handlers. Does NOT start the HTTP server -- that is handled by entry points.
- `packages/backend/src/entry-node.ts`: Node.js entry point. Imports `app` from `index.ts`, calls `initDb()`, `setRuntime(nodeRuntime)`, starts HTTP server via `@hono/node-server`.
- `packages/backend/src/entry-worker.ts`: Cloudflare Workers entry point. Imports `app` from `index.ts`, calls `initDbD1()`, `setRuntime(workerRuntime)`, exports as `default { fetch }`.
- `packages/backend/src/env.ts` (`getEnv`, `Env`): Zod-validated environment config singleton. Required: `DATABASE_URL`, `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `JWT_SECRET`, `PORT`, `NODE_ENV`. Exits on validation failure.
- `packages/backend/src/db.ts` (`getDb`, `closeDb`, `initDb`, `initDbD1`): Dual-mode database. `initDb()` uses postgres.js driver (Node.js); `initDbD1()` uses Cloudflare D1 binding (SQLite). Both produce a drizzle-orm instance.
- `packages/backend/src/runtime/types.ts` (`PasswordHasher`, `StorageAdapter`): Interfaces for platform-abstracted password hashing and object storage.
- `packages/backend/src/runtime/node.ts`: Node.js runtime -- argon2 for password hashing, S3Client for storage.
- `packages/backend/src/runtime/worker.ts`: CF Workers runtime -- PBKDF2 via Web Crypto for password hashing, R2 binding for storage.
- `packages/backend/src/runtime/index.ts` (`setRuntime`, `getRuntime`): Global runtime registry. Called once at startup by the entry point.
- `packages/backend/src/middleware/auth.ts` (`requireAuth`, `requireRole`, `requireNsRole`): Three RBAC middleware layers. `requireAuth` detects `sk_live_` prefix on Bearer tokens and routes to `validateApiKey`; otherwise validates JWT.
- `packages/backend/src/utils/jwt.ts` (`signJwt`, `verifyJwt`, `JwtPayload`): HS256 JWT using `jose` library. Payload: `sub` (userId), `username`, `role`. Default expiry: 7 days.
- `packages/backend/src/routes/auth.ts` (`authRoutes`): Auth routes -- register, device code flow (3 endpoints), `/me`.
- `packages/backend/src/routes/skills.ts` (`skillsRoutes`): Skill CRUD routes. Push supports multipart and JSON body (web publishing).
- `packages/backend/src/routes/namespaces.ts` (`namespaceRoutes`): Namespace and member management.
- `packages/backend/src/routes/apikeys.ts` (`apikeyRoutes`): API key CRUD -- create, list, get, revoke, rotate.
- `packages/backend/src/routes/admin.ts` (`adminRoutes`): Admin-only routes -- stats, user management, audit logs.
- `packages/backend/src/routes/mcp.ts` (`mcpRoutes`): Built-in MCP SSE endpoints.
- `packages/backend/src/routes/health.ts` (`healthRoutes`): Health check probing DB and S3/R2 connectivity.
- `packages/backend/src/services/auth.service.ts`: User registration, authentication, Device Code lifecycle.
- `packages/backend/src/services/skill.service.ts`: Skill upsert, query, search (ilike), delete, download counting.
- `packages/backend/src/services/storage.service.ts`: Storage wrapper. Delegates to runtime adapter (`getRuntime().storage`).
- `packages/backend/src/services/apikey.service.ts`: API key creation (sha256 hash stored), validation, rotation, revocation.
- `packages/backend/src/services/audit.service.ts` (`logAuditEvent`, `queryAuditLogs`): Fire-and-forget audit log writes; query with filters.

## 3. Execution Flow (LLM Retrieval Map)

### Request Lifecycle

- **1. Entry:** HTTP request hits Hono app in `packages/backend/src/index.ts`.
- **2. Global Middleware:** `cors()` then `logger()` applied to all routes.
- **3. Routing:** Dispatched to one of 7 route groups: `/health`, `/api/auth`, `/api/skills`, `/api/namespaces`, `/api/auth/apikeys`, `/api/admin`, `/mcp`.
- **4. Auth Middleware:** Protected routes invoke `requireAuth` which extracts Bearer token. If token starts with `sk_live_`, validates via `apikey.service.validateApiKey`; otherwise calls `verifyJwt`.
- **5. RBAC Middleware:** Namespace-scoped routes invoke `requireNsRole` which queries `ns_members` table. Admin bypasses all checks.
- **6. Route Handler:** Delegates to service layer or direct DB operations.
- **7. Error Handling:** Unhandled errors caught by `app.onError`, returning 500. Unmatched routes return 404.

### Runtime Adapter Pattern

- **1.** Entry point (`entry-node.ts` or `entry-worker.ts`) calls `setRuntime()` with platform-specific implementations.
- **2.** `runtime/types.ts` defines `PasswordHasher` (hash/verify) and `StorageAdapter` (upload/download/signedUrl/delete) interfaces.
- **3.** `runtime/node.ts`: argon2 hashing + S3Client (`@aws-sdk/client-s3`, `forcePathStyle: true`).
- **4.** `runtime/worker.ts`: PBKDF2 hashing (Web Crypto) + R2 binding. Note: cannot verify argon2 hashes (requires password reset when migrating from Node to Workers).
- **5.** Services call `getRuntime()` to access platform-agnostic password hashing and storage.

## 4. Design Rationale

- **Separate entry points** (`entry-node.ts` / `entry-worker.ts`) keep the Hono app (`index.ts`) platform-agnostic and testable.
- **Runtime Adapter Pattern** enables deploying the same business logic to both Docker and CF Workers without conditional imports.
- **Namespace routes skip service layer** -- direct DB operations since logic is simple CRUD.
- **Device Code token endpoint returns HTTP 200 for errors** to comply with OAuth 2.0 Device Authorization Grant spec.
- **API Key validation** is integrated into `requireAuth` via prefix detection, avoiding a separate middleware chain.
