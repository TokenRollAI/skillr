# Architecture of Authentication and RBAC

## 1. Identity

- **What it is:** The authentication, authorization, and audit subsystem for Skillr.
- **Purpose:** Authenticates users via Device Code flow, API Keys, or machine tokens, enforces two-layer RBAC (global + namespace), and logs security-relevant events.

## 2. Core Components

- `apps/api/src/utils/jwt.ts` (`signJwt`, `verifyJwt`, `JwtPayload`): JWT signing (HS256 via `jose`) and verification. Secret from `getJwtSecret()` (per-request binding), default expiry `7d`. Payload: `{ sub, username, role }`.
- `apps/api/src/middleware/auth.ts` (`requireAuth`, `requireRole`, `requireNsRole`): Hono middleware chain. Extracts Bearer token; detects `sk_live_` prefix to route to API Key validation, otherwise verifies JWT. Injects `user` into Hono context.
- `apps/api/src/services/auth.service.ts` (`createDeviceCode`, `approveDeviceCode`, `pollDeviceToken`, `authenticateUser`, `registerUser`): Device Code grant implementation. Password hashing via `apps/api/src/lib/password.ts` (PBKDF2).
- `apps/api/src/services/apikey.service.ts` (`createApiKey`, `validateApiKey`, `revokeApiKey`, `rotateApiKey`, `listApiKeys`): API Key lifecycle. Keys are SHA-256 hashed before storage; only the prefix (`sk_live_<first8>`) is stored in cleartext for lookup.
- `apps/api/src/lib/password.ts` (`hashPassword`, `verifyPassword`): PBKDF2 via Web Crypto API. Format: `iterations:salt:hash` (hex-encoded). Single implementation (no runtime adapter).
- `apps/api/src/models/device-code.ts` (`deviceCodes`): `device_codes` table with `pending -> approved -> used` state machine.
- `apps/api/src/models/user.ts` (`users`): Users table. Global `role` field defaults to `'viewer'`.
- `apps/api/src/models/namespace.ts` (`namespaces`, `nsMembers`): `ns_members` join table with composite PK `(userId, namespaceId)`, namespace-level `role` defaults to `'viewer'`.
- `apps/api/src/models/audit-log.ts` (`auditLogs`): `audit_logs` table.
- `apps/api/src/services/audit.service.ts` (`logAuditEvent`, `queryAuditLogs`): Audit write and query.
- `apps/api/src/routes/auth.ts` (`authRoutes`): Auth HTTP routes for device code flow and user info.
- `apps/api/src/routes/apikeys.ts` (`apikeyRoutes`): API Key CRUD routes.
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
- **4. Lifecycle:** List, Get, Revoke, Rotate via `/api/auth/apikeys` endpoints.

### 3c. Password Hashing

- **PBKDF2 only:** Uses Web Crypto API in `apps/api/src/lib/password.ts`. 100k iterations, 16-byte salt, SHA-256.
- **No argon2 support.** Users migrated from the old Node.js deployment must reset their passwords.

### 3d. Middleware Chain

- **Global:** Per-request init -> `cors()` -> `logger()` (applied in `apps/api/src/index.ts`).
- **Per-route:** `requireAuth` -> optionally `requireRole(role)` or `requireNsRole(nsParam, ...roles)` -> handler.
- **Admin bypass:** `user.role === 'admin'` skips all role checks.

### 3e. RBAC Permission Matrix

| Operation | Global Admin | NS Maintainer | NS Viewer | Anonymous |
|---|---|---|---|---|
| Read skills/namespaces | Yes | Yes | Yes | Yes |
| Push skill | Yes | Yes | No | No |
| Delete skill | Yes | Yes | No | No |
| Manage NS members | Yes | Yes | No | No |
| Create namespace | Yes | Yes (any authed) | Yes (any authed) | No |

### 3f. Namespace Visibility

- **Public:** Listed to all users including anonymous.
- **Internal:** Listed to all authenticated users.
- **Private:** Only namespace members and global admins.
- Direct access to private namespace skills returns 404 (not 403) to avoid information leakage.

### 3g. Audit Logging

- **Write:** `logAuditEvent()` in `apps/api/src/services/audit.service.ts`.
- **Recorded events:** `user.register`, `skill.push`, `skill.delete`, `apikey.create`, `apikey.revoke`.
- **Query:** `queryAuditLogs()` with filters. Exposed via `GET /api/admin/audit` (admin only).

## 4. Design Rationale

- **HS256 symmetric signing** chosen for simplicity in single-backend deployment.
- **Device Code flow** enables CLI authentication without exposing credentials in terminal.
- **API Key prefix detection** (`sk_live_`) in `requireAuth` allows a single middleware to handle both JWT and API Key auth transparently.
- **Two-layer RBAC** separates platform governance (global admin) from project-level access (namespace maintainer).
- **No refresh tokens:** Tokens expire after 7 days; users must re-authenticate.
