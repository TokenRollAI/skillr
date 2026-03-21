# Architecture of Authentication and RBAC

## 1. Identity

- **What it is:** The authentication, authorization, and audit subsystem for Skillr.
- **Purpose:** Authenticates users via Device Code flow, API Keys, or machine tokens, enforces two-layer RBAC (global + namespace), and logs security-relevant events.

## 2. Core Components

- `packages/backend/src/utils/jwt.ts` (`signJwt`, `verifyJwt`, `JwtPayload`): JWT signing (HS256 via `jose`) and verification. Secret from `JWT_SECRET` env var, default expiry `7d`. Payload: `{ sub, username, role }`.
- `packages/backend/src/middleware/auth.ts` (`requireAuth`, `requireRole`, `requireNsRole`): Hono middleware chain. Extracts Bearer token; detects `sk_live_` prefix to route to API Key validation, otherwise verifies JWT. Injects `user` into Hono context.
- `packages/backend/src/services/auth.service.ts` (`createDeviceCode`, `approveDeviceCode`, `pollDeviceToken`, `authenticateUser`, `registerUser`): Device Code grant implementation. Password hashing delegated to Runtime Adapter.
- `packages/backend/src/services/apikey.service.ts` (`createApiKey`, `validateApiKey`, `revokeApiKey`, `rotateApiKey`, `listApiKeys`): API Key lifecycle. Keys are SHA-256 hashed before storage; only the prefix (`sk_live_<first8>`) is stored in cleartext for lookup.
- `packages/backend/src/models/device-code.ts` (`deviceCodes`): `device_codes` table with `pending -> approved -> used` state machine.
- `packages/backend/src/models/user.ts` (`users`): Users table. Global `role` field defaults to `'viewer'`.
- `packages/backend/src/models/namespace.ts` (`namespaces`, `nsMembers`): `ns_members` join table with composite PK `(userId, namespaceId)`, namespace-level `role` defaults to `'viewer'`.
- `packages/backend/src/models/audit-log.ts` (`auditLogs`): `audit_logs` table with indexes on `userId`, `action`, `createdAt`.
- `packages/backend/src/services/audit.service.ts` (`logAuditEvent`, `queryAuditLogs`): Audit write and query.
- `packages/backend/src/routes/auth.ts` (`authRoutes`): Auth HTTP routes for device code flow and user info.
- `packages/backend/src/routes/apikeys.ts` (`apikeyRoutes`): API Key CRUD routes.
- `packages/cli/src/lib/config.ts` (`getAuthToken`, `loadConfig`, `saveConfig`): CLI token resolution. `SKILLHUB_TOKEN` env var takes priority over config file.
- `packages/cli/src/commands/auth.ts` (`loginFlow`, `logout`, `whoami`, `authStatus`): CLI-side device code polling and token storage.
- `packages/cli/src/lib/registry-client.ts` (`RegistryClient`): HTTP client that attaches `Authorization: Bearer` header.
- `packages/mcp/src/index.ts`: MCP server reads `SKILLHUB_TOKEN` env var for API auth.

## 3. Execution Flow (LLM Retrieval Map)

### 3a. Device Code Authentication (RFC 8628)

- **1. CLI initiates:** `RegistryClient.requestDeviceCode()` sends `POST /api/auth/device/code` (no auth required).
- **2. Backend generates codes:** `createDeviceCode()` generates 32-byte hex `deviceCode` + 8-char uppercase `userCode`, stores in `device_codes` with status `pending`, 15min expiry.
- **3. CLI polls:** CLI displays `userCode` + `verification_uri`, polls `POST /api/auth/device/token` at `interval` seconds.
- **4. Browser approves:** User enters `userCode` on `/device` page. Backend calls `approveDeviceCode()` which sets status to `approved`.
- **5. Token issued:** Next CLI poll finds `approved` status. `pollDeviceToken()` issues JWT via `signJwt()`, marks record `used`.
- **6. CLI stores:** Token saved to `~/.skillr/config.json` under `auth[sourceUrl]` with `type: 'device_code'`.

### 3b. API Key Authentication

- **1. Create:** User calls `POST /api/auth/apikeys` with `{ name, scopes?, expiresIn? }`. Backend generates `sk_live_<32-byte-hex>`, stores SHA-256 hash + prefix in `api_keys` table. Full key returned once.
- **2. Use:** Client sends `Authorization: Bearer sk_live_xxx`. `requireAuth` middleware detects `sk_live_` prefix and calls `validateApiKey` instead of `verifyJwt`.
- **3. Validation:** `validateApiKey` looks up by prefix, compares SHA-256 hash, checks `revoked` and `expires_at`, updates `last_used_at`.
- **4. Lifecycle:** List (`GET /api/auth/apikeys`), Get (`GET /api/auth/apikeys/:id`), Revoke (`DELETE /api/auth/apikeys/:id`), Rotate (`POST /api/auth/apikeys/:id/rotate`).
- **5. CLI usage:** `SKILLHUB_TOKEN=sk_live_xxx skillr whoami` -- works with any CLI command.

### 3c. Machine Token Flow

- **1. Token injection:** Set `SKILLHUB_TOKEN` env var with a valid JWT or API Key.
- **2. CLI resolution:** `getAuthToken()` in `packages/cli/src/lib/config.ts` checks `process.env[ENV_TOKEN_KEY]` first, skips config file if present.
- **3. MCP resolution:** `packages/mcp/src/index.ts` reads `process.env.SKILLHUB_TOKEN` directly.
- **4. Backend agnostic:** `requireAuth` middleware handles both JWT and API Key tokens transparently.

### 3d. Password Hashing (Runtime-Dependent)

- **Node.js runtime:** Uses argon2 (native binding) via `runtime/node.ts`. Full hash/verify support.
- **CF Workers runtime:** Uses PBKDF2 via Web Crypto API in `runtime/worker.ts`. Cannot verify argon2 hashes -- users migrated from Node.js to Workers must reset their passwords.

### 3e. Middleware Chain

- **Global:** `cors()` -> `logger()` (applied in `packages/backend/src/index.ts`).
- **Per-route:** `requireAuth` -> optionally `requireRole(role)` or `requireNsRole(nsParam, ...roles)` -> handler.
- **Admin bypass:** `user.role === 'admin'` skips all role checks.

### 3f. RBAC Permission Matrix

| Operation | Global Admin | NS Maintainer | NS Viewer | Anonymous |
|---|---|---|---|---|
| Read skills/namespaces | Yes | Yes | Yes | Yes |
| Push skill | Yes | Yes | No | No |
| Delete skill | Yes | Yes | No | No |
| Manage NS members | Yes | Yes | No | No |
| Create namespace | Yes | Yes (any authed) | Yes (any authed) | No |

- **Global roles** (`users.role`): `admin`, `viewer` (default). Stored in JWT payload, no DB query at check time.
- **Namespace roles** (`ns_members.role`): `maintainer`, `viewer` (default). Queried from DB on each request.

### 3g. Namespace Visibility

Namespaces support a `visibility` field with three values: `public`, `internal`, `private`.

- **Public:** Listed to all users including anonymous. Skills searchable and downloadable by anyone.
- **Internal:** Listed to all authenticated users. Hidden from anonymous access.
- **Private:** Filtered from listing and search for non-members. Only namespace members and global admins can access.
- Direct access to private namespace skills returns 404 (not 403) to avoid information leakage.

### 3h. Audit Logging

- **Write:** `logAuditEvent()` in `packages/backend/src/services/audit.service.ts`. Direct INSERT.
- **Recorded events:** `user.register`, `skill.push`, `skill.delete`, `apikey.create`, `apikey.revoke`.
- **Query:** `queryAuditLogs()` supports filters: `action`, `userId`, `from`/`to` time range. Paginated. Exposed via `GET /api/admin/audit` (admin only).

## 4. Design Rationale

- **HS256 symmetric signing** chosen for simplicity in single-backend deployment.
- **Device Code flow** enables CLI authentication without exposing credentials in terminal.
- **API Key prefix detection** (`sk_live_`) in `requireAuth` allows a single middleware to handle both JWT and API Key auth transparently.
- **Two-layer RBAC** separates platform governance (global admin) from project-level access (namespace maintainer).
- **No refresh tokens:** Tokens expire after 7 days; users must re-authenticate.
