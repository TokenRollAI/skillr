# Skillr - LLM Documentation Index

Skillr is an enterprise-grade skill aggregation and distribution platform for AI coding agents (Claude Code, Codex, OpenClaw). It provides a CLI (`skillr`), REST API backend, web frontend, and MCP gateway (dual-mode: built-in SSE + standalone stdio) for publishing, discovering, installing, and managing packaged AI agent skills (`.tar.gz` with `SKILL.md` manifest) across multi-registry federated namespaces with RBAC access control. Cloudflare-First architecture: Workers + D1 + R2. 8 database tables, 7 API route groups, 8 CLI commands. API Key system (`sk_live_*`) for programmatic access.

## Quick Navigation

| Question | Document |
|----------|----------|
| What is this project? | [overview/project-overview.md](overview/project-overview.md) |
| How does the CLI work? | [architecture/cli-command-system.md](architecture/cli-command-system.md) |
| How does the backend API work? | [architecture/backend-api.md](architecture/backend-api.md) |
| How does auth and RBAC work? | [architecture/auth-and-rbac.md](architecture/auth-and-rbac.md) |
| How does a skill flow through the system? | [architecture/skill-lifecycle.md](architecture/skill-lifecycle.md) |
| How do I use CLI commands? | [guides/cli-usage-guide.md](guides/cli-usage-guide.md) |
| How do I authenticate? | [guides/authentication-guide.md](guides/authentication-guide.md) |
| How do I publish or install a skill? | [guides/publish-and-install-guide.md](guides/publish-and-install-guide.md) |
| How do I deploy? | [guides/deployment-guide.md](guides/deployment-guide.md) |
| What API endpoints exist? | [reference/api-endpoints.md](reference/api-endpoints.md) |
| What does the database look like? | [reference/database-schema.md](reference/database-schema.md) |
| What are the coding standards? | [reference/coding-conventions.md](reference/coding-conventions.md) |
| What are the git/CI conventions? | [reference/git-conventions.md](reference/git-conventions.md) |

## Documents by Category

### overview/ -- Project Context

| Document | Description |
|----------|-------------|
| [project-overview.md](overview/project-overview.md) | Project identity, Cloudflare-First tech stack (D1/R2/Workers), architecture diagram, core domain concepts, and key design decisions. |

### architecture/ -- System Design (LLM Retrieval Maps)

| Document | Description |
|----------|-------------|
| [cli-command-system.md](architecture/cli-command-system.md) | Commander.js CLI structure: 8 commands (login, source, auth, scan, push, install, update, search), dual-mode output, config at `~/.skillr/`. |
| [backend-api.md](architecture/backend-api.md) | Hono REST API on CF Workers: 7 route groups, D1-only database, R2 storage, per-request initialization middleware, single entry point (`index.ts`). |
| [auth-and-rbac.md](architecture/auth-and-rbac.md) | Device Code auth, API Key auth (`sk_live_*`), JWT (HS256, 7d), two-layer RBAC, three-tier namespace visibility, PBKDF2 password hashing, audit logging. |
| [skill-lifecycle.md](architecture/skill-lifecycle.md) | End-to-end skill flow: scan, push (CLI->Backend->R2), install (R2 download proxy->CLI), update, search (CLI/API/MCP dual-mode). |

### guides/ -- Step-by-Step Instructions

| Document | Description |
|----------|-------------|
| [cli-usage-guide.md](guides/cli-usage-guide.md) | All CLI commands: `skillr login`, source management, auth, scan, push, install, update, search, and JSON output mode. |
| [authentication-guide.md](guides/authentication-guide.md) | Device Code login, API Keys (create/use/rotate/revoke), machine tokens (SKILLHUB_TOKEN), RBAC roles, namespace members. |
| [publish-and-install-guide.md](guides/publish-and-install-guide.md) | Creating SKILL.md, publishing (CLI + web), installing, symlink auto-detection, updating, MCP dual-mode (SSE + stdio). |
| [deployment-guide.md](guides/deployment-guide.md) | Cloudflare Workers deployment (D1 + R2 + wrangler), local dev with `wrangler dev`. |

### reference/ -- Lookup Information

| Document | Description |
|----------|-------------|
| [api-endpoints.md](reference/api-endpoints.md) | All REST endpoints. 7 route groups: health, auth, apikeys, skills, namespaces, admin, mcp. Plus R2 download proxy. |
| [database-schema.md](reference/database-schema.md) | 8 tables (users, namespaces, ns_members, skills, skill_tags, device_codes, api_keys, audit_logs). SQLite/D1-only schema. |
| [coding-conventions.md](reference/coding-conventions.md) | TypeScript strict/ESM, pnpm workspaces, wrangler builds, Vitest, service-layer pattern, per-request initialization, naming. |
| [git-conventions.md](reference/git-conventions.md) | Main branch, PR workflow, Conventional Commits, CI pipeline (typecheck, test, build), pnpm 10 + Node 22. |

## Document Tree

```
llmdoc/
  index.md
  overview/
    project-overview.md
  architecture/
    cli-command-system.md
    backend-api.md
    auth-and-rbac.md
    skill-lifecycle.md
  guides/
    cli-usage-guide.md
    authentication-guide.md
    publish-and-install-guide.md
    deployment-guide.md
  reference/
    api-endpoints.md
    database-schema.md
    coding-conventions.md
    git-conventions.md
```
