# Skillr

AI Agent Skill Registry - discover, install and manage skills.

Follows the **Open Agent Skills Standard**, providing a unified skill discovery, aggregation, distribution and reuse platform for AI coding assistants like Claude Code, Codex, OpenClaw, etc.

## Quick Start

### Requirements

- Node.js >= 18
- pnpm >= 10
- Docker & Docker Compose

### Quick Start (One Command)

```bash
git clone <repo-url> && cd skillr
pnpm install
pnpm up        # Builds and starts everything: PostgreSQL, MinIO, Backend, Frontend
```

Open http://localhost:3000 — done! Default admin: `admin` / `admin123`

```bash
pnpm logs      # Tail all service logs
pnpm down      # Stop all services (keep data)
pnpm down:clean # Stop and wipe all data
```

### Dev Mode (Manual Control)

```bash
# Start only infrastructure (PostgreSQL + MinIO)
pnpm dev:infra

# Database migration + seed data
pnpm --filter @skillr/backend db:migrate
pnpm --filter @skillr/backend db:seed

# Start backend (port 3001)
pnpm --filter @skillr/backend dev

# Start frontend (port 3000)
pnpm --filter @skillr/frontend dev

# Build CLI
pnpm --filter @skillr/cli build
```

### CLI Usage

```bash
# First-time setup: login to a server
skillr login http://localhost:3001

# Multi-server workflow
skillr login http://localhost:3001          # Dev server
skillr login https://skills.company.com     # Production server
skillr source list                          # See all configured servers
skillr source set-default production

# Multi-source management
skillr source add internal https://skills.company.com

# Scan local skills
skillr scan ./my-skills/

# Publish skill (CLI or Web)
cd my-skill-dir/
skillr push @default/my-skill -t v1.0.0
# Or publish via browser: open http://localhost:3000/skills/publish

# Search skills (supports fuzzy matching, no namespace required)
skillr search "deploy"
skillr search "deploy" --namespace @frontend

# Install skill (auto symlink to .claude/ or .agents/)
skillr install @default/my-skill

# Update installed skills
skillr update
```

## Project Structure

```
skillr/
├── packages/
│   ├── shared/       # Shared types and constants
│   ├── cli/          # CLI tool (skillr)
│   ├── backend/      # Hono API server (includes built-in MCP endpoint)
│   │   └── src/runtime/  # Runtime Adapter Pattern (Node.js / CF Workers)
│   ├── frontend/     # Next.js Web UI
│   └── mcp/          # Standalone MCP server (stdio transport)
├── docker/
│   ├── docker-compose.yml     # Local dev environment
│   ├── Dockerfile.backend     # Backend production image
│   └── Dockerfile.frontend    # Frontend production image
└── docs/                      # Architecture and task docs
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Monorepo | pnpm workspaces |
| CLI | Commander.js + TypeScript |
| Backend | Hono + Drizzle ORM |
| Database | PostgreSQL (Node.js) / Cloudflare D1 (Workers) |
| Frontend | Next.js 15 + Tailwind CSS v4 |
| Object Storage | MinIO/S3 (Node.js) / Cloudflare R2 (Workers) |
| Password Hashing | argon2 (Node.js) / PBKDF2 Web Crypto (Workers) |
| MCP | @modelcontextprotocol/sdk (SSE built-in + stdio standalone) |
| Testing | Vitest |
| Containers | Docker Compose |
| Edge Runtime | Cloudflare Workers |

## Deployment

### Docker (Node.js)

The default deployment mode. `pnpm up` starts everything locally. For production, use `docker/Dockerfile.backend` and `docker/Dockerfile.frontend`.

### Cloudflare Workers (D1 + R2)

```bash
# Prerequisites: wrangler CLI, Cloudflare account
wrangler d1 create skillr-db
wrangler r2 bucket create skillr-artifacts
wrangler d1 execute skillr-db --remote --file=packages/backend/d1-migration.sql
wrangler secret put JWT_SECRET
wrangler deploy
```

See `llmdoc/guides/deployment-guide.md` for full instructions.

**Runtime note:** Users created with argon2 (Node.js) cannot log in on CF Workers (PBKDF2). Password reset required after migration.

## API Key Authentication

For CI/CD and automation, create API Keys instead of relying on JWTs:

1. Create via web UI (`/settings/keys`) or API (`POST /api/auth/apikeys`)
2. Use: `SKILLHUB_TOKEN=sk_live_xxx skillr push @ns/skill`
3. Rotate: `POST /api/auth/apikeys/:id/rotate`
4. Revoke: `DELETE /api/auth/apikeys/:id`

## MCP Integration

### Mode 1: Built-in SSE (recommended)

MCP is built into the backend server -- no separate process required:

```json
// ~/.claude/settings.json
{
  "mcpServers": {
    "skillr": {
      "type": "sse",
      "url": "http://localhost:3001/mcp/sse"
    }
  }
}
```

### Mode 2: Standalone stdio (@skillr/mcp)

For Claude Desktop or tools requiring process-based MCP:

```json
{
  "mcpServers": {
    "skillr": {
      "command": "npx",
      "args": ["@skillr/mcp"],
      "env": {
        "SKILLHUB_BACKEND_URL": "http://localhost:3001",
        "SKILLHUB_TOKEN": "sk_live_xxx"
      }
    }
  }
}
```

Available MCP tools for agents:
- `search_skills` -- Search skills
- `get_skill_info` -- Get skill details
- `list_namespaces` -- List namespaces
- `get_install_instructions` -- Get install instructions

## Docker Local Dev

```bash
# Start PostgreSQL + MinIO
docker compose -f docker/docker-compose.yml up -d

# Verify
docker compose -f docker/docker-compose.yml exec postgres psql -U skillhub -d skillhub -c "SELECT 1;"
curl -sf http://localhost:9000/minio/health/live && echo "MinIO OK"

# Stop (keep data)
docker compose -f docker/docker-compose.yml down

# Stop (clear data)
docker compose -f docker/docker-compose.yml down -v
```

## Testing

```bash
# Run all tests
pnpm test

# Run CLI tests only
pnpm --filter @skillr/cli test

# Watch mode
pnpm --filter @skillr/cli test:watch
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://skillhub:skillhub@localhost:5432/skillhub` | PostgreSQL connection string |
| `S3_ENDPOINT` | `http://localhost:9000` | MinIO/S3 endpoint |
| `S3_ACCESS_KEY` | `minioadmin` | S3 Access Key |
| `S3_SECRET_KEY` | `minioadmin` | S3 Secret Key |
| `S3_BUCKET` | `skillhub-artifacts` | S3 bucket name |
| `JWT_SECRET` | -- | JWT signing secret (required in production) |
| `SKILLHUB_TOKEN` | -- | CLI/Agent auth token (JWT or API Key `sk_live_*`) |
| `SKILLHUB_CONFIG_DIR` | `~/.skillr` | CLI config directory |

## License

MIT
