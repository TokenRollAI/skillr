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
│   └── frontend/     # Next.js Web UI
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
| Backend | Hono + Drizzle ORM + PostgreSQL |
| Frontend | Next.js 15 + Tailwind CSS v4 |
| Object Storage | MinIO (S3 compatible) |
| MCP | @modelcontextprotocol/sdk |
| Testing | Vitest |
| Containers | Docker Compose |

## MCP Integration

MCP is built into the backend server -- no separate process required. Add the Skillr MCP endpoint to your AI agent:

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

Available MCP tools for agents:
- `search_skills` — Search skills
- `get_skill_info` — Get skill details
- `list_namespaces` — List namespaces
- `get_install_instructions` — Get install instructions

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
| `JWT_SECRET` | — | JWT signing secret (required in production) |
| `SKILLHUB_TOKEN` | — | CLI/Agent auth token |
| `SKILLHUB_CONFIG_DIR` | `~/.skillhub` | CLI config directory |

## License

MIT
