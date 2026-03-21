# API Endpoints Reference

## 1. Core Summary

The Skillr backend exposes a REST API via Hono at 7 route prefixes: `/health`, `/api/auth`, `/api/skills`, `/api/namespaces`, `/api/auth/apikeys`, `/api/admin`, `/mcp`. Read operations are unauthenticated (public registry pattern). Write operations require Bearer JWT or API Key (`sk_live_*`), with namespace-scoped RBAC for skill push/delete and member management. MCP endpoints are built into the backend (no separate process).

## 2. Source of Truth

- **Auth routes:** `packages/backend/src/routes/auth.ts`
- **API Key routes:** `packages/backend/src/routes/apikeys.ts`
- **Skills routes:** `packages/backend/src/routes/skills.ts`
- **Namespace routes:** `packages/backend/src/routes/namespaces.ts`
- **Admin routes:** `packages/backend/src/routes/admin.ts`
- **MCP routes:** `packages/backend/src/routes/mcp.ts`
- **Health route:** `packages/backend/src/routes/health.ts`
- **Middleware:** `packages/backend/src/middleware/auth.ts`
- **Related Architecture:** `/llmdoc/architecture/backend-api.md`

## 3. Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | None | Returns DB and S3/R2 connectivity status. Response: `{ status, db, s3 }` |

## 4. Auth Endpoints (`/api/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | None | Register user. Body: `{ username, email, password }`. Returns 201 `{ id, username, email }`. |
| POST | `/api/auth/login` | None | Login with credentials. Body: `{ username, password }`. Returns `{ access_token, token_type, expires_in }`. |
| PUT | `/api/auth/password` | Bearer JWT | Change password. Body: `{ currentPassword, newPassword }`. |
| POST | `/api/auth/device/code` | None | Create device code. Returns `{ device_code, user_code, verification_uri, expires_in: 900, interval: 5 }`. |
| POST | `/api/auth/device/approve` | Bearer JWT | Approve device code. Body: `{ user_code }`. |
| POST | `/api/auth/device/token` | None | Poll for token. Body: `{ device_code, grant_type }`. Returns token or error (HTTP 200 per OAuth spec). |
| GET | `/api/auth/me` | Bearer JWT | Get current user info. Returns `{ id, username, email, role }`. |

## 4b. API Key Endpoints (`/api/auth/apikeys`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/apikeys` | Bearer JWT | Create API key. Body: `{ name, scopes?, expiresIn? }`. Returns the full key (shown only once). |
| GET | `/api/auth/apikeys` | Bearer JWT | List all API keys for the current user. Returns array of key metadata (no secrets). |
| GET | `/api/auth/apikeys/:id` | Bearer JWT | Get single API key metadata by ID. |
| DELETE | `/api/auth/apikeys/:id` | Bearer JWT | Revoke/delete an API key. |
| POST | `/api/auth/apikeys/:id/rotate` | Bearer JWT | Rotate an API key. Invalidates old key, returns new one. |

## 5. Skills Endpoints (`/api/skills`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/skills` | None | Search/list skills. Query: `q`, `namespace`, `page`, `limit`. Ordered by downloads desc. |
| GET | `/api/skills/:ns/:name` | None | Get skill detail with readme, tags, downloads. |
| GET | `/api/skills/:ns/:name/tags` | None | List all tags for a skill. |
| GET | `/api/skills/:ns/:name/tags/:tag` | None | Get tag detail with presigned download URL (1hr TTL). Increments downloads. |
| POST | `/api/skills/:ns/:name` | Bearer + ns maintainer | Push skill. Query: `tag`. Accepts multipart/form-data **or JSON body** (web publish). Max 50MB. |
| DELETE | `/api/skills/:ns/:name` | Bearer + ns maintainer | Delete skill and all artifacts. |

## 6. Namespace Endpoints (`/api/namespaces`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/namespaces` | Bearer JWT | Create namespace. Body: `{ name, description?, visibility? }`. Creator auto-added as maintainer. |
| GET | `/api/namespaces` | None | List namespaces. Private namespaces filtered for non-members. |
| GET | `/api/namespaces/:name` | None | Get single namespace. |
| POST | `/api/namespaces/:name/members` | Bearer + ns maintainer | Add member. Body: `{ userId, role? }`. |
| GET | `/api/namespaces/:name/members` | None | List namespace members. |
| DELETE | `/api/namespaces/:name/members/:userId` | Bearer + ns maintainer | Remove member. |

## 7. Admin Endpoints (`/api/admin`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/stats` | Bearer + admin | Platform statistics. |
| GET | `/api/admin/users` | Bearer + admin | List all users. |
| GET | `/api/admin/audit` | Bearer + admin | Query audit logs with filters. |
| PUT | `/api/admin/users/:id/role` | Bearer + admin | Update user global role. Body: `{ role }`. |

## 8. MCP Endpoints (`/mcp`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/mcp/sse` | None | SSE connection endpoint for MCP clients. |
| POST | `/mcp/message` | None | JSON-RPC message endpoint. |
| GET | `/mcp/tools` | None | List available MCP tools. |
| POST | `/mcp/call` | None | Call an MCP tool directly. |

Available MCP tools: `search_skills`, `get_skill_info`, `list_namespaces`, `get_install_instructions`.

## 9. Auth Requirements Summary

- **No auth:** All GET endpoints (search, list, get, health, tags, download), MCP endpoints
- **Bearer (JWT or API Key):** register (none), login (none), device/code (none), device/token (none), device/approve (JWT), `/me` (JWT), create namespace, password change, API key management
- **Bearer + ns maintainer:** skill push, skill delete, add member, remove member
- **Bearer + admin:** all `/api/admin/*` endpoints
- **Admin bypass:** Admin role skips all namespace-level permission checks
