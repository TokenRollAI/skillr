# skillr

AI Agent Skill Registry CLI -- discover, install and manage skills for Claude, Codex, and more.

## Install

```bash
npm install -g skillr
```

Or with other package managers:

```bash
pnpm add -g skillr
yarn global add skillr
npx skillr --help    # Run without installing
```

## Quick Start

```bash
# 1. Connect to a Skillr server (URL required, no default)
skillr login https://your-skillr-server.com

# For local development
skillr login http://localhost:3001

# 2. Search for skills
skillr search "deploy"

# 3. Install a skill
skillr install @default/deploy-helper

# 4. Done! The skill is symlinked to your project:
#    .claude/skills/@default/deploy-helper  (Claude Code)
#    .agents/skills/@default/deploy-helper  (Codex/OpenClaw)
```

## Commands

### Authentication

```bash
skillr login <url>           # Login to a Skillr server (auto-adds as source)
skillr auth logout           # Logout
skillr auth whoami           # Show current user
skillr auth status           # Show auth status for all servers
```

### API Key Authentication

For CI/CD pipelines and automation, use API Keys instead of interactive login:

```bash
# Create an API key via web UI (/settings/keys) or API
# Then use it with any CLI command:
SKILLHUB_TOKEN=sk_live_xxx skillr push @ns/my-skill
SKILLHUB_TOKEN=sk_live_xxx skillr whoami

# Or export for the session:
export SKILLHUB_TOKEN=sk_live_xxx
skillr push @ns/my-skill
skillr install @ns/other-skill
```

Token priority: `SKILLHUB_TOKEN` env var > stored config token.

### Multi-Server

```bash
# Connect to multiple Skillr servers
skillr login http://localhost:3001           # Dev
skillr login https://skills.company.com      # Production

# Manage sources
skillr source list                           # List all servers
skillr source set-default production         # Switch default
skillr source remove old-server              # Remove a server
```

### Skills

```bash
# Scan local directory for SKILL.md files
skillr scan [directory]

# Publish a skill
cd my-skill/
skillr push @namespace/skill-name -t v1.0.0
skillr push my-skill                         # Short name -> @default/my-skill

# Install a skill
skillr install @namespace/skill-name
skillr install skill-name                    # Auto-resolves namespace

# Update installed skills
skillr update                                # Update all
skillr update @namespace/skill-name          # Update specific

# Search
skillr search "query"
skillr search "deploy" --namespace @frontend
```

### Output Modes

```bash
# Human-friendly (default in terminal)
skillr search deploy

# JSON output (for agents/scripts)
skillr search deploy --json
echo "deploy" | skillr search --json    # Auto-detects pipe -> JSON
```

## SKILL.md Format

Every skill needs a `SKILL.md` file with YAML frontmatter:

```markdown
---
name: my-skill
description: What this skill does
version: 1.0.0
---

# My Skill

Instructions for the AI agent...
```

Required fields: `name`, `description`

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SKILLHUB_TOKEN` | API key (`sk_live_*`) or JWT for authentication (overrides config) |
| `SKILLHUB_CONFIG_DIR` | Custom config directory (default: `~/.skillr`) |

## Configuration

Config is stored at `~/.skillr/config.json`:

```json
{
  "sources": [
    { "name": "default", "url": "http://localhost:3001", "default": true },
    { "name": "production", "url": "https://skills.company.com" }
  ],
  "auth": {
    "http://localhost:3001": { "token": "...", "type": "device_code" }
  }
}
```

## Deploy Your Own Skillr Server

### Docker (Node.js)

```bash
git clone https://github.com/tokenroll/skillr
cd skillr
pnpm install
pnpm up    # One-command Docker startup (PostgreSQL + MinIO + Backend + Frontend)
```

Open http://localhost:3000 -- default admin: `admin` / `admin123`

### Cloudflare Workers (D1 + R2)

```bash
wrangler d1 create skillr-db
wrangler r2 bucket create skillr-artifacts
wrangler d1 execute skillr-db --remote --file=packages/backend/d1-migration.sql
wrangler secret put JWT_SECRET
wrangler deploy
```

## License

MIT
