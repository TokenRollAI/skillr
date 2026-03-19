# API Endpoints Reference

## 1. Core Summary

The Skillhub backend exposes a REST API via Hono at 4 route prefixes: `/health`, `/api/auth`, `/api/skills`, `/api/namespaces`. Read operations are unauthenticated (public registry pattern). Write operations require Bearer JWT, with namespace-scoped RBAC for skill push/delete and member management.

## 2. Source of Truth

- **Auth routes:** `packages/backend/src/routes/auth.ts`
- **Skills routes:** `packages/backend/src/routes/skills.ts`
- **Namespace routes:** `packages/backend/src/routes/namespaces.ts`
- **Health route:** `packages/backend/src/routes/health.ts`
- **Middleware:** `packages/backend/src/middleware/auth.ts`
- **Related Architecture:** `/llmdoc/architecture/backend-api.md`

## 3. Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | None | Returns DB and S3 connectivity status. Response: `{ status, db, s3 }` |

## 4. Auth Endpoints (`/api/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | None | Register user. Body: `{ username, email, password }` (Zod validated). Returns 201 `{ id, username, email }`. 409 on duplicate. |
| POST | `/api/auth/device/code` | None | Create device code. Returns `{ device_code, user_code, verification_uri, expires_in: 900, interval: 5 }`. |
| POST | `/api/auth/device/approve` | Bearer JWT | Approve device code. Body: `{ user_code }` (8 chars). Returns `{ success: true }`. Errors: 404 invalid_code, 409 already_used, 410 expired. |
| POST | `/api/auth/device/token` | None | Poll for token. Body: `{ device_code, grant_type }`. Returns `{ access_token, token_type, expires_in }` or `{ error }` (HTTP 200 per OAuth spec). Errors: `authorization_pending`, `expired_token`, `invalid_code`. |
| GET | `/api/auth/me` | Bearer JWT | Get current user info. Returns `{ id, username, email, role }`. |

## 5. Skills Endpoints (`/api/skills`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/skills` | None | Search/list skills. Query params: `q`, `namespace`, `page` (default 1), `limit` (default 20, max 100). Ordered by downloads desc. |
| GET | `/api/skills/:ns/:name` | None | Get skill detail. Returns `{ name, namespace, description, latestTag, downloads, readme, createdAt, updatedAt }`. |
| GET | `/api/skills/:ns/:name/tags` | None | List all tags for a skill. Returns array of `{ tag, sizeBytes, checksum, createdAt }`. |
| GET | `/api/skills/:ns/:name/tags/:tag` | None | Get tag detail with pre-signed download URL (1hr TTL). Increments download counter. Returns `{ tag, sizeBytes, checksum, downloadUrl, createdAt }`. |
| POST | `/api/skills/:ns/:name` | Bearer JWT + ns maintainer | Push skill artifact. Query param: `tag` (default `latest`). Accepts `multipart/form-data` (fields: tarball, description, readme, metadata) or raw binary. Max 50MB. Returns 201 `{ name, tag, checksum, size, artifactKey }`. |
| DELETE | `/api/skills/:ns/:name` | Bearer JWT + ns maintainer | Delete skill and all S3 artifacts. Returns `{ success: true }`. |

## 6. Namespace Endpoints (`/api/namespaces`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/namespaces` | Bearer JWT | Create namespace. Body: `{ name, description?, visibility? }`. Name must match `^@[a-z0-9][a-z0-9-]*$`. Creator auto-added as maintainer. Returns 201. |
| GET | `/api/namespaces` | None | List all namespaces, ordered by name. |
| GET | `/api/namespaces/:name` | None | Get single namespace by name. |
| POST | `/api/namespaces/:name/members` | Bearer JWT + ns maintainer | Add member. Body: `{ userId, role? }` (default `viewer`). Returns 201. 409 on duplicate. |
| GET | `/api/namespaces/:name/members` | None | List namespace members with user info (JOIN). Returns array of `{ userId, role, username, email }`. |
| DELETE | `/api/namespaces/:name/members/:userId` | Bearer JWT + ns maintainer | Remove member from namespace. |

## 7. Auth Requirements Summary

- **No auth:** All GET endpoints (search, list, get, health, tags, download)
- **Bearer JWT only:** register (none), device/code (none), device/token (none), device/approve (JWT), `/me` (JWT), create namespace (JWT)
- **Bearer JWT + ns maintainer:** skill push, skill delete, add member, remove member
- **Admin bypass:** Admin role skips all namespace-level permission checks
