# Skillr

AI Agent Skill Registry — discover, install and manage skills for Claude Code, Codex, and more.

[![npm version](https://img.shields.io/npm/v/skillr)](https://www.npmjs.com/package/skillr)

## Quick Start

```bash
# Install CLI
npm install -g skillr

# Login to registry
skillr login https://api.skillhub.tokenroll.ai

# Search and install skills
skillr search "code-review"
skillr install @default/code-review
```

## Create & Publish Skills

```bash
# Scaffold a new skill project
skillr init --name my-skill

# Or a workspace with multiple skills
skillr init --workspace --name my-skills --namespace @myteam

# Publish
skillr push
```

### skill.json

Every skill project has a `skill.json` manifest:

```json
{
  "name": "my-skill",
  "description": "What this skill does",
  "version": "1.0.0",
  "author": "you",
  "license": "MIT",
  "agents": ["claude-code", "codex"],
  "tags": ["utility"],
  "namespace": "@default"
}
```

Workspace mode (multiple skills):

```json
{
  "name": "@myteam/skills",
  "namespace": "@myteam",
  "version": "1.0.0",
  "skills": [
    { "path": "skills/review", "name": "review", "description": "Code review" },
    { "path": "skills/tdd", "name": "tdd", "description": "TDD workflow" }
  ]
}
```

Each skill directory contains a `SKILL.md` with the actual skill content/instructions.

## CLI Commands

| Command | Description |
|---------|-------------|
| `skillr login <url>` | Login to a registry |
| `skillr init` | Scaffold a new skill project |
| `skillr scan` | Validate skill.json and SKILL.md files |
| `skillr push [ref]` | Publish skill(s) to the registry |
| `skillr search <query>` | Search for skills (`--agent`, `--tag` filters) |
| `skillr install <ref>` | Install a skill (auto-symlinks to `.claude/` or `.agents/`) |
| `skillr update` | Update installed skills |
| `skillr source` | Manage registry sources |
| `skillr auth` | Manage API keys |

## Project Structure

```
skillr/
├── apps/
│   ├── api/         # Hono REST API on Cloudflare Workers (D1 + R2)
│   └── web/         # Next.js frontend on CF Workers Static Assets
├── packages/
│   ├── shared/      # Shared types and constants
│   ├── cli/         # CLI tool (npm: skillr)
│   └── mcp/         # Standalone MCP server (stdio)
└── docs/            # Specs and plans
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Monorepo | pnpm workspaces |
| CLI | Commander.js, TypeScript |
| Backend | Hono, Drizzle ORM, Cloudflare Workers |
| Database | Cloudflare D1 (SQLite) |
| Storage | Cloudflare R2 |
| Frontend | Next.js 15, Tailwind CSS v4 |
| Auth | JWT (HS256), PBKDF2 (Web Crypto), API Keys |
| MCP | SSE (built-in) + stdio (standalone) |
| Testing | Vitest |

## Deployment

Cloudflare-First architecture. No Docker required.

```bash
# API
cd apps/api && wrangler deploy

# Web
cd apps/web && next build && wrangler deploy
```

See `llmdoc/guides/deployment-guide.md` for full instructions.

## API Key Authentication

For CI/CD and automation:

```bash
# Use API key with CLI
SKILLHUB_TOKEN=sk_live_xxx skillr push @ns/skill
```

Create/manage keys via web UI (`/settings/keys`) or API (`POST /api/auth/apikeys`).

## MCP Integration

```json
{
  "mcpServers": {
    "skillr": {
      "type": "sse",
      "url": "https://api.skillhub.tokenroll.ai/mcp/sse"
    }
  }
}
```

Tools: `search_skills`, `get_skill_info`, `list_namespaces`, `get_install_instructions`

## Live Instance

- **Web**: https://skillhub.tokenroll.ai
- **API**: https://api.skillhub.tokenroll.ai
- **npm**: https://www.npmjs.com/package/skillr

## License

MIT
