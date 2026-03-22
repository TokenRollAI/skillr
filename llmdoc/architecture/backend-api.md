# Architecture of Backend API

## 1. Identity

- **What it is:** A Hono-based REST API running on Cloudflare Workers, providing authentication, skill registry, and namespace management for Skillr.
- **Purpose:** Serves as the central backend for the Skillr platform, handling user auth (JWT + Device Code + API Key), skill artifact storage (R2), and RBAC-based access control. Cloudflare-First: D1 (SQLite) + R2 only.

## 2. Core Components

- `apps/api/src/index.ts` (`app`): Hono app definition AND Worker entry point. Registers per-request initialization middleware (DB, R2, env), global middleware (cors, logger), mounts 7 route prefixes, registers error/404 handlers. Exports as `default` Worker.
- `apps/api/src/env.ts` (`Bindings`, `AppEnv`, `setEnvFromBindings`, `getJwtSecret`, `getFrontendUrl`): Hono Bindings type definition. Per-request globals set from Worker bindings (DB, ARTIFACTS, JWT_SECRET, FRONTEND_URL). No Zod, no `process.env`.
- `apps/api/src/db.ts` (`initDb`, `getDb`): D1-only database. `initDb(d1)` creates drizzle-orm instance from D1 binding. Per-request re-initialization.
- `apps/api/src/lib/storage.ts` (`setBucket`, `uploadArtifact`, `downloadArtifact`, `deleteArtifact`, `checkR2Connection`): Direct R2 binding operations. Per-request bucket set via middleware.
- `apps/api/src/lib/password.ts` (`hashPassword`, `verifyPassword`): Web Crypto PBKDF2 password hashing. Format: `iterations:salt:hash` (hex-encoded).
- `apps/api/src/middleware/auth.ts` (`requireAuth`, `requireRole`, `requireNsRole`): Three RBAC middleware layers. `requireAuth` detects `sk_live_` prefix on Bearer tokens and routes to `validateApiKey`; otherwise validates JWT.
- `apps/api/src/utils/jwt.ts` (`signJwt`, `verifyJwt`, `JwtPayload`): HS256 JWT using `jose` library. Secret from `getJwtSecret()` (per-request). Payload: `sub` (userId), `username`, `role`. Default expiry: 7 days.
- `apps/api/src/routes/auth.ts` (`authRoutes`): Auth routes -- register, device code flow (3 endpoints), `/me`.
- `apps/api/src/routes/skills.ts` (`skillsRoutes`): Skill CRUD routes + R2 download proxy (`GET /download/:key`). Push supports multipart and JSON body.
- `apps/api/src/routes/namespaces.ts` (`namespaceRoutes`): Namespace and member management.
- `apps/api/src/routes/apikeys.ts` (`apikeyRoutes`): API key CRUD -- create, list, get, revoke, rotate.
- `apps/api/src/routes/admin.ts` (`adminRoutes`): Admin-only routes -- stats, user management, audit logs.
- `apps/api/src/routes/mcp.ts` (`mcpRoutes`): Built-in MCP SSE endpoints.
- `apps/api/src/routes/health.ts` (`healthRoutes`): Health check probing DB and R2 connectivity.
- `apps/api/src/services/auth.service.ts`: User registration, authentication, Device Code lifecycle. Uses `password.ts` directly.
- `apps/api/src/services/skill.service.ts`: Skill upsert, query, search (`like` for SQLite), delete, download counting. Uses `storage.ts` directly.
- `apps/api/src/services/apikey.service.ts`: API key creation (sha256 hash stored), validation, rotation, revocation.
- `apps/api/src/services/audit.service.ts` (`logAuditEvent`, `queryAuditLogs`): Fire-and-forget audit log writes; query with filters.
- `apps/api/wrangler.toml`: Worker configuration. Bindings: `DB` (D1), `ARTIFACTS` (R2), `JWT_SECRET` (secret), `FRONTEND_URL` (var).

## 3. Execution Flow (LLM Retrieval Map)

### Request Lifecycle

- **1. Entry:** HTTP request hits CF Worker, Hono app in `apps/api/src/index.ts`.
- **2. Per-request init:** Middleware calls `setEnvFromBindings(c.env)`, `initDb(c.env.DB)`, `setBucket(c.env.ARTIFACTS)` to set per-request globals from Worker bindings.
- **3. Global Middleware:** `cors()` then `logger()` applied to all routes.
- **4. Routing:** Dispatched to one of 7 route groups: `/health`, `/api/auth`, `/api/skills`, `/api/namespaces`, `/api/auth/apikeys`, `/api/admin`, `/mcp`.
- **5. Auth Middleware:** Protected routes invoke `requireAuth` which extracts Bearer token. If token starts with `sk_live_`, validates via `apikey.service.validateApiKey`; otherwise calls `verifyJwt`.
- **6. RBAC Middleware:** Namespace-scoped routes invoke `requireNsRole` which queries `ns_members` table. Admin bypasses all checks.
- **7. Route Handler:** Delegates to service layer or direct DB operations.
- **8. Error Handling:** Unhandled errors caught by `app.onError`, returning 500. Unmatched routes return 404.

## 4. Design Rationale

- **Single entry point** (`index.ts`) serves as both app definition and Worker export. No separate entry files needed.
- **Per-request initialization** replaces the old Runtime Adapter Pattern. Worker bindings (D1, R2, secrets) are injected via Hono middleware on every request.
- **No Runtime Adapter** -- removed `src/runtime/` entirely. Platform-specific code (PBKDF2, R2) lives directly in `src/lib/password.ts` and `src/lib/storage.ts`.
- **R2 download proxy** (`GET /api/skills/download/:key`) replaces presigned URLs. Worker streams R2 object body directly to client.
- **SQLite `like` replaces PostgreSQL `ilike`** in search queries for D1 compatibility.
