# How to Authenticate and Manage Access in Skillr

## Login via CLI (Device Code Flow)

1. **Initiate login:** Run `skillr login <server-url>` (e.g., `skillr login http://localhost:3001`). The URL is required -- there is no default source. This registers the server as a source and calls `POST /api/auth/device/code`, displaying a `user_code` and `verification_uri`. Alternatively, use `skillr auth login` if the source is already configured. See `packages/cli/src/commands/auth.ts` (`loginFlow`).
2. **Multi-server login:** Run `skillr login` with different URLs to authenticate against multiple servers:
   ```
   skillr login http://localhost:3001
   skillr login https://skills.company.com
   ```
   Tokens are stored per source URL in `~/.skillr/config.json`.
3. **Authorize in browser:** Open the `verification_uri` in a browser where you are already logged into the Skillr web UI. Enter the displayed `user_code` on the `/device` page. The page sends `POST /api/auth/device/approve` with your existing browser JWT.
4. **CLI receives token:** The CLI automatically polls the backend. Once approved, it receives a JWT (valid 7 days) and stores it in `~/.skillr/config.json`. Polling handles `authorization_pending`, `slow_down` (adds 5s delay), `expired_token`, and `access_denied` responses.
5. **Verify:** Run `skillr auth whoami` to confirm authentication status.

## Use API Keys (CI/CD, Automation)

1. **Create an API key:** Via the Skillr web UI at `/settings/keys`, or via API: `POST /api/auth/apikeys` with `{ name, scopes?, expiresIn? }`. The full key (`sk_live_<hex>`) is returned only once -- save it securely.
2. **Use with CLI:** Set the environment variable: `SKILLHUB_TOKEN=sk_live_xxx skillr whoami`. Works with any CLI command.
3. **Use with MCP:** Set `SKILLHUB_TOKEN=sk_live_xxx` in the MCP server environment.
4. **Rotate a key:** `POST /api/auth/apikeys/:id/rotate` -- invalidates the old key and returns a new one.
5. **Revoke a key:** `DELETE /api/auth/apikeys/:id` -- immediately invalidates the key.
6. **List keys:** `GET /api/auth/apikeys` -- returns metadata (name, prefix, scopes, last_used_at) without secrets.

## Use Machine Tokens (Legacy JWT)

1. **Obtain a valid JWT:** Generate one through the device code flow or web login.
2. **Set environment variable:** Export `SKILLHUB_TOKEN=<jwt>`. Both CLI (`packages/cli/src/lib/config.ts`) and MCP server (`packages/mcp/src/index.ts`) read this env var.
3. **Priority rule:** `SKILLHUB_TOKEN` always overrides any token stored in `~/.skillr/config.json`. The backend detects token type automatically (`sk_live_` prefix = API Key, otherwise JWT).
4. **Verify:** Run `skillr auth status`; it should display `Authenticated (env token)`.

## RBAC Permissions

1. **Global roles** are stored in `users.role` and embedded in the JWT payload (`sub`, `username`, `role`). Two values: `admin` (superuser, bypasses all checks) and `viewer` (default for new users).
2. **Namespace roles** are stored in `ns_members.role` and queried from DB per request. Two values: `maintainer` (push/delete skills, manage members) and `viewer` (default, read-only).
3. **Middleware chain:** Routes use `requireAuth` for authentication, then optionally `requireRole(role)` for global checks or `requireNsRole(nsParam, ...roles)` for namespace checks. See `packages/backend/src/middleware/auth.ts`.
4. **Admin override:** Global `admin` role bypasses both `requireRole` and `requireNsRole` unconditionally.

## Manage Namespace Members

1. **Create a namespace:** Any authenticated user can `POST /api/namespaces`. The creator is automatically added as `maintainer`. See `packages/backend/src/routes/namespaces.ts`.
2. **Add a member:** A namespace `maintainer` (or global `admin`) sends `POST /api/namespaces/:name/members` with the target user ID and role.
3. **Remove a member:** Send `DELETE /api/namespaces/:name/members/:userId`. Same permission requirements as adding.
4. **Verify:** Query the namespace details to confirm the member list has been updated.
