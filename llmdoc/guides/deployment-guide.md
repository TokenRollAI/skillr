# How to Deploy Skillr

Two deployment modes: Docker (Node.js) and Cloudflare Workers (D1 + R2).

## Docker Deployment (Node.js)

1. **Quick start:** Clone the repo and run `pnpm install && pnpm up`. This builds all packages and starts PostgreSQL, MinIO, Backend, and Frontend via Docker Compose.
2. **Verify:** Open `http://localhost:3000`. Default admin: `admin` / `admin123`.
3. **Environment:** Configure via environment variables. See `packages/backend/src/env.ts` for required vars: `DATABASE_URL`, `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `JWT_SECRET`.
4. **Production images:** Build with `docker/Dockerfile.backend` and `docker/Dockerfile.frontend` (3-stage builds, non-root runner).
5. **Stop:** `pnpm down` (keep data) or `pnpm down:clean` (wipe data).

## Cloudflare Workers Deployment (D1 + R2)

### Prerequisites

- Cloudflare account with Workers, D1, and R2 enabled.
- `wrangler` CLI installed (`npm install -g wrangler`).
- `wrangler login` completed.

### Steps

1. **Create D1 database:**
   ```bash
   wrangler d1 create skillr-db
   ```
   Note the database ID from the output and update `wrangler.toml`.

2. **Create R2 bucket:**
   ```bash
   wrangler r2 bucket create skillr-artifacts
   ```

3. **Run D1 migration:**
   ```bash
   wrangler d1 execute skillr-db --remote --file=packages/backend/d1-migration.sql
   ```

4. **Set secrets:**
   ```bash
   wrangler secret put JWT_SECRET
   ```

5. **Deploy:**
   ```bash
   wrangler deploy
   ```

6. **Custom domain (optional):** Configure via Cloudflare dashboard under Workers > your worker > Triggers > Custom Domains.

7. **Verify:** `curl https://your-worker.your-domain.workers.dev/health` should return `{ "status": "ok" }`.

## Runtime Differences

| Aspect | Node.js (Docker) | CF Workers (D1 + R2) |
|--------|-------------------|----------------------|
| Database | PostgreSQL (postgres.js) | D1 (SQLite) |
| Storage | MinIO / S3 (aws-sdk) | R2 (binding) |
| Password hashing | argon2 (native) | PBKDF2 (Web Crypto) |
| Entry point | `entry-node.ts` | `entry-worker.ts` |
| DB init | `initDb()` | `initDbD1()` |

**Migration caveat:** Users created with argon2 (Node.js) cannot log in on CF Workers (PBKDF2 cannot verify argon2 hashes). Affected users must reset their passwords after migration.

Reference: `packages/backend/src/runtime/` for adapter implementations.
