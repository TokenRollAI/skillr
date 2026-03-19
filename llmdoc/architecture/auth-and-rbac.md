# Architecture of Authentication and RBAC

## 1. Identity

- **What it is:** The authentication, authorization, and audit subsystem for Skillhub.
- **Purpose:** Authenticates users via Device Code flow or machine tokens, enforces two-layer RBAC (global + namespace), and logs security-relevant events.

## 2. Core Components

- `packages/backend/src/utils/jwt.ts` (`signJwt`, `verifyJwt`, `JwtPayload`): JWT signing (HS256 via `jose`) and verification. Secret from `JWT_SECRET` env var, default expiry `7d`. Payload: `{ sub, username, role }`.
- `packages/backend/src/middleware/auth.ts` (`requireAuth`, `requireRole`, `requireNsRole`): Hono middleware chain. Extracts Bearer token, verifies JWT, injects `user` into context. Role checks at global and namespace levels.
- `packages/backend/src/services/auth.service.ts` (`createDeviceCode`, `approveDeviceCode`, `pollDeviceToken`, `authenticateUser`, `registerUser`): Device Code grant implementation. Password hashing with `argon2`.
- `packages/backend/src/models/device-code.ts` (`deviceCodes`): `device_codes` table with `pending -> approved -> used` state machine.
- `packages/backend/src/models/user.ts` (`users`): Users table. Global `role` field defaults to `'viewer'`.
- `packages/backend/src/models/namespace.ts` (`namespaces`, `nsMembers`): `ns_members` join table with composite PK `(userId, namespaceId)`, namespace-level `role` defaults to `'viewer'`.
- `packages/backend/src/models/audit-log.ts` (`auditLogs`): `audit_logs` table with indexes on `userId`, `action`, `createdAt`.
- `packages/backend/src/services/audit.service.ts` (`logAuditEvent`, `queryAuditLogs`): Audit write (direct INSERT) and query (filter by action/userId/time, paginated, default 50/page).
- `packages/backend/src/routes/auth.ts` (`authRoutes`): Auth HTTP routes for device code flow and user info.
- `packages/backend/src/env.ts` (`envSchema`, `getEnv`): `JWT_SECRET` validated via Zod, minimum 16 chars.
- `packages/cli/src/lib/config.ts` (`getAuthToken`, `loadConfig`, `saveConfig`): CLI token resolution. `SKILLHUB_TOKEN` env var takes priority over config file.
- `packages/cli/src/commands/auth.ts` (`loginFlow`, `logout`, `whoami`, `authStatus`): CLI-side device code polling and token storage.
- `packages/cli/src/lib/registry-client.ts` (`RegistryClient`): HTTP client that attaches `Authorization: Bearer` header.
- `packages/mcp/src/index.ts`: MCP server reads `SKILLHUB_TOKEN` env var for API auth.

## 3. Execution Flow (LLM Retrieval Map)

### 3a. Device Code Authentication (RFC 8628)

- **1. CLI initiates:** `RegistryClient.requestDeviceCode()` sends `POST /api/auth/device/code` (no auth required). See `packages/cli/src/lib/registry-client.ts`.
- **2. Backend generates codes:** `createDeviceCode()` in `packages/backend/src/services/auth.service.ts:40-53` generates 32-byte hex `deviceCode` + 8-char uppercase `userCode`, stores in `device_codes` with status `pending`, 15min expiry. Returns `verification_uri`, `expires_in: 900`, `interval: 5`.
- **3. CLI polls:** CLI displays `userCode` + `verification_uri`, polls `POST /api/auth/device/token` at `interval` seconds. On `slow_down` response, interval increases by 5s. See `packages/cli/src/commands/auth.ts`.
- **4. Browser approves:** User enters `userCode` on `/device` page (`packages/frontend/src/app/device/page.tsx`). Page reads JWT from `localStorage('skillhub_token')` and sends `POST /api/auth/device/approve` (requires `requireAuth`). Backend calls `approveDeviceCode()` which sets status to `approved`.
- **5. Token issued:** Next CLI poll finds `approved` status. `pollDeviceToken()` in `packages/backend/src/services/auth.service.ts:72-101` issues JWT via `signJwt()`, marks record `used` (one-time). Returns `{ access_token, token_type: 'Bearer', expires_in: 604800 }`.
- **6. CLI stores:** Token saved to `~/.skillhub/config.json` under `auth[sourceUrl]` with `type: 'device_code'`. See `packages/cli/src/lib/config.ts:54-61`.

### 3b. Machine Token Flow

- **1. Token injection:** Set `SKILLHUB_TOKEN` env var with a valid JWT.
- **2. CLI resolution:** `getAuthToken()` in `packages/cli/src/lib/config.ts:69-74` checks `process.env[ENV_TOKEN_KEY]` first, skips config file if present.
- **3. MCP resolution:** `packages/mcp/src/index.ts` reads `process.env.SKILLHUB_TOKEN` directly.
- **4. Backend agnostic:** `requireAuth` middleware only validates JWT signature/expiry; does not distinguish token origin.

### 3c. Middleware Chain

- **Global:** `cors()` -> `logger()` (applied in `packages/backend/src/index.ts`).
- **Per-route:** `requireAuth` -> optionally `requireRole(role)` or `requireNsRole(nsParam, ...roles)` -> handler.
- **Admin bypass:** `user.role === 'admin'` skips all role checks in both `requireRole` and `requireNsRole`.

### 3d. RBAC Permission Matrix

| Operation | Global Admin | NS Maintainer | NS Viewer | Anonymous |
|---|---|---|---|---|
| Read skills/namespaces | Yes | Yes | Yes | Yes |
| Push skill | Yes | Yes | No | No |
| Delete skill | Yes | Yes | No | No |
| Manage NS members | Yes | Yes | No | No |
| Create namespace | Yes | Yes (any authed) | Yes (any authed) | No |

- **Global roles** (`users.role`): `admin`, `viewer` (default). Stored in JWT payload, no DB query at check time.
- **Namespace roles** (`ns_members.role`): `maintainer`, `viewer` (default). Queried from DB on each request by `requireNsRole`.

### 3e. Audit Logging

- **Write:** `logAuditEvent()` in `packages/backend/src/services/audit.service.ts:5-15`. Direct INSERT, no async error protection.
- **Recorded events:** `user.register` (in auth routes), `skill.push` and `skill.delete` (in skills routes).
- **Query:** `queryAuditLogs()` supports filters: `action`, `userId`, `from`/`to` time range. Paginated (default 50), descending by time.
- **Note:** No HTTP endpoint exposes audit query; currently DB-only access.

## 4. Design Rationale

- **HS256 symmetric signing** chosen for simplicity in a single-backend deployment; `JWT_SECRET` must be secured in production.
- **Device Code flow** enables CLI authentication without exposing credentials in terminal, following RFC 8628 semantics.
- **Two-layer RBAC** separates platform governance (global admin) from project-level access (namespace maintainer), with admin as unconditional superuser.
- **No refresh tokens:** Tokens expire after 7 days; users must re-authenticate. Simplifies token management at the cost of re-login frequency.
