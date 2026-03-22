# How to Deploy Skillr

Skillr uses a Cloudflare-First architecture. All services deploy to Cloudflare Workers + D1 + R2. No Docker or Node.js server deployment.

## Prerequisites

- Cloudflare account with Workers, D1, and R2 enabled.
- `wrangler` CLI installed (included as devDependency in `apps/api`).
- `wrangler login` completed.

## Deploy Backend (API)

1. **Create D1 database:**
   ```bash
   wrangler d1 create skillr-db
   ```
   Update the `database_id` in `apps/api/wrangler.toml`.

2. **Create R2 bucket:**
   ```bash
   wrangler r2 bucket create skillr-artifacts
   ```

3. **Run D1 migration:**
   ```bash
   cd apps/api && wrangler d1 execute skillr-db --remote --file=d1-migration.sql
   ```

4. **Set secrets:**
   ```bash
   cd apps/api && wrangler secret put JWT_SECRET
   ```

5. **Deploy:**
   ```bash
   cd apps/api && wrangler deploy
   ```

6. **Verify:** `curl https://api.skillhub.tokenroll.ai/health` should return `{ "status": "ok" }`.

## Deploy Frontend (Web)

1. **Build static export:**
   ```bash
   cd apps/web && pnpm build
   ```
   This produces a static export in `apps/web/out/`.

2. **Deploy:**
   ```bash
   cd apps/web && wrangler deploy
   ```
   The `wrangler.toml` configures Workers Static Assets to serve from `out/`.

## Local Development

1. **Backend:** `cd apps/api && wrangler dev` -- starts local Workers runtime with D1 and R2 emulation.
2. **Frontend:** `cd apps/web && pnpm dev` -- starts Next.js dev server on port 3000.

## Configuration Reference

- **Backend wrangler.toml:** `apps/api/wrangler.toml` -- D1 binding (`DB`), R2 binding (`ARTIFACTS`), vars (`FRONTEND_URL`).
- **Frontend wrangler.toml:** `apps/web/wrangler.toml` -- Workers Static Assets from `out/` directory.
- **Related Architecture:** `/llmdoc/architecture/backend-api.md`
