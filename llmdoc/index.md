# Skillhub - LLM Documentation Index

Skillhub is an enterprise-grade skill aggregation and distribution platform for AI coding agents (Claude Code, Codex, OpenClaw). It provides a CLI, REST API backend, web frontend, and MCP gateway for publishing, discovering, installing, and managing packaged AI agent skills (`.tar.gz` with `SKILL.md` manifest) across multi-registry federated namespaces with RBAC access control.

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
| What API endpoints exist? | [reference/api-endpoints.md](reference/api-endpoints.md) |
| What does the database look like? | [reference/database-schema.md](reference/database-schema.md) |
| What are the coding standards? | [reference/coding-conventions.md](reference/coding-conventions.md) |
| What are the git/CI conventions? | [reference/git-conventions.md](reference/git-conventions.md) |

## Documents by Category

### overview/ -- Project Context

| Document | Description |
|----------|-------------|
| [project-overview.md](overview/project-overview.md) | Project identity, tech stack, architecture diagram, core domain concepts, and key design decisions. |

### architecture/ -- System Design (LLM Retrieval Maps)

| Document | Description |
|----------|-------------|
| [cli-command-system.md](architecture/cli-command-system.md) | Commander.js CLI structure: 7 commands, dual-mode output, config management, registry client, and smart install resolution flow. |
| [backend-api.md](architecture/backend-api.md) | Hono REST API: request lifecycle, 4 route groups, service layer, middleware chain, and skill push flow. |
| [auth-and-rbac.md](architecture/auth-and-rbac.md) | Device Code auth (RFC 8628), machine token flow, JWT (HS256, 7d), two-layer RBAC (global + namespace), permission matrix, audit logging. |
| [skill-lifecycle.md](architecture/skill-lifecycle.md) | End-to-end skill flow: scan, push (CLI->Backend->S3), install (S3 presigned URL->CLI), update, search (CLI/API/MCP). |

### guides/ -- Step-by-Step Instructions

| Document | Description |
|----------|-------------|
| [cli-usage-guide.md](guides/cli-usage-guide.md) | All CLI commands: source management, auth, scan, push, install, update, search, and JSON output mode. |
| [authentication-guide.md](guides/authentication-guide.md) | Device Code login, machine tokens (SKILLHUB_TOKEN), RBAC roles, and namespace member management. |
| [publish-and-install-guide.md](guides/publish-and-install-guide.md) | Creating SKILL.md, publishing, installing, symlink auto-detection, updating, and MCP gateway usage. |

### reference/ -- Lookup Information

| Document | Description |
|----------|-------------|
| [api-endpoints.md](reference/api-endpoints.md) | All REST endpoints with method, path, auth requirements, request/response details. 6 route groups: health, auth, skills, namespaces, admin, mcp. |
| [database-schema.md](reference/database-schema.md) | 7 PostgreSQL tables (users, namespaces, ns_members, skills, skill_tags, device_codes, audit_logs) with columns, types, constraints, indexes, and relationships. |
| [coding-conventions.md](reference/coding-conventions.md) | TypeScript strict/ESM, pnpm workspaces, tsup/Next.js builds, Vitest testing, service-layer pattern, OutputAdapter, naming, error handling. |
| [git-conventions.md](reference/git-conventions.md) | Single main branch, PR workflow, CI pipeline (typecheck, test, build, docker), pnpm 10 + Node 22. |

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
  reference/
    api-endpoints.md
    database-schema.md
    coding-conventions.md
    git-conventions.md
```
