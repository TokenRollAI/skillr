# How to Authenticate and Manage Access in Skillhub

## Login via CLI (Device Code Flow)

1. **Initiate login:** Run `skillr login <server-url>` (e.g., `skillr login http://localhost:3001`). The URL is required -- there is no default source. This registers the server as a source and calls `POST /api/auth/device/code`, displaying a `user_code` and `verification_uri`. Alternatively, use `skillr auth login` if the source is already configured. See `packages/cli/src/commands/auth.ts` (`loginFlow`).
2. **Multi-server login:** Run `skillr login` with different URLs to authenticate against multiple servers:
   ```
   skillr login http://localhost:3001
   skillr login https://skills.company.com
   ```
   Tokens are stored per source URL in `~/.skillhub/config.json`.
3. **Authorize in browser:** Open the `verification_uri` in a browser where you are already logged into the Skillhub web UI. Enter the displayed `user_code` on the `/device` page. The page sends `POST /api/auth/device/approve` with your existing browser JWT.
4. **CLI receives token:** The CLI automatically polls the backend. Once approved, it receives a JWT (valid 7 days) and stores it in `~/.skillhub/config.json`. Polling handles `authorization_pending`, `slow_down` (adds 5s delay), `expired_token`, and `access_denied` responses.
5. **Verify:** Run the `whoami` CLI command to confirm authentication status.

## Use Machine Tokens (CI/CD, MCP Server)

1. **Obtain a valid JWT:** Currently there is no dedicated machine-token endpoint. Use an existing JWT or generate one through the device code flow.
2. **Set environment variable:** Export `SKILLHUB_TOKEN=<jwt>`. Both CLI (`packages/cli/src/lib/config.ts:69-74`) and MCP server (`packages/mcp/src/index.ts`) read this env var.
3. **Priority rule:** `SKILLHUB_TOKEN` always overrides any token stored in `~/.skillhub/config.json`. The backend does not distinguish between device-code tokens and machine tokens.
4. **Verify:** Run the CLI `auth status` command; it should display `Authenticated (env token)`.

## RBAC Permissions

1. **Global roles** are stored in `users.role` and embedded in the JWT payload (`sub`, `username`, `role`). Two values: `admin` (superuser, bypasses all checks) and `viewer` (default for new users).
2. **Namespace roles** are stored in `ns_members.role` and queried from DB per request. Two values: `maintainer` (push/delete skills, manage members) and `viewer` (default, read-only).
3. **Middleware chain:** Routes use `requireAuth` for authentication, then optionally `requireRole(role)` for global checks or `requireNsRole(nsParam, ...roles)` for namespace checks. See `packages/backend/src/middleware/auth.ts`.
4. **Admin override:** Global `admin` role bypasses both `requireRole` and `requireNsRole` unconditionally.

## Manage Namespace Members

1. **Create a namespace:** Any authenticated user can `POST /api/namespaces`. The creator is automatically added as `maintainer`. See `packages/backend/src/routes/namespaces.ts`.
2. **Add a member:** A namespace `maintainer` (or global `admin`) sends `POST /api/namespaces/:name/members` with the target user ID and role. Route requires `requireAuth` + `requireNsRole('name', 'maintainer')`.
3. **Remove a member:** Send `DELETE /api/namespaces/:name/members/:userId`. Same permission requirements as adding.
4. **Verify:** Query the namespace details to confirm the member list has been updated.
