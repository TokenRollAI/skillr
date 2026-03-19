# Skillhub - AI Agent Skill Registry

## 1. Identity

- **What it is:** An enterprise-grade skill aggregation and distribution platform for AI coding agents (Claude Code, Codex, OpenClaw) -- the "DockerHub + NPM" for AI Agent skills.
- **Purpose:** Provides unified discovery, publishing, installation, and reuse of AI agent skills following the Open Agent Skills Standard.

## 2. High-Level Description

Skillhub enables developers and AI agents to publish, discover, and install packaged skill directories (`.tar.gz` containing a `SKILL.md` manifest). The system supports multi-registry federation (client-side, similar to Homebrew taps), namespace-based RBAC with private namespace filtering, OAuth Device Code authentication for humans, API Key system for programmatic access, and environment-variable token injection for machines/agents. A dual-mode CLI outputs human-friendly or machine-parseable (JSON) responses based on TTY detection. Skills can also be published via the web UI at `/skills/publish` for non-technical users.

## 3. Tech Stack

| Layer | Technology | Package |
|---|---|---|
| Monorepo | pnpm workspaces, TypeScript (ES2022, strict) | root `pnpm-workspace.yaml` |
| Shared types | TypeScript interfaces + constants, zero deps | `packages/shared` (`@skillhub/shared`) |
| CLI | Commander.js v13, chalk, cli-table3, fast-glob, gray-matter, tar | `packages/cli` (`@skillhub/cli`) |
| Backend API | Hono v4, Drizzle ORM v0.39, jose (JWT), argon2, @hono/node-server | `packages/backend` (`@skillhub/backend`) |
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS v4, zustand, lucide-react | `packages/frontend` (`@skillhub/frontend`) |
| MCP Gateway | @modelcontextprotocol/sdk v1.12, built into backend (SSE transport) | `packages/backend` (integrated) |
| Database | PostgreSQL 16 (via postgres.js driver) | `docker/docker-compose.yml` |
| Object Storage | MinIO / S3-compatible (forcePathStyle) | `docker/docker-compose.yml` |
| CI/CD | GitHub Actions (lint, typecheck, unit test, build, docker validate) | `.github/workflows/ci.yml` |

## 4. Architecture Overview

```
CLI (skillr)  ──HTTP/REST──>  Backend (Hono :3001)  ──>  PostgreSQL
       |                              |
       |                              ├──>  MinIO/S3 (artifacts)
       |                              |          ^
       └──S3 presigned URL (download)─┘──────────┘
                                      |
                                      └──>  /mcp/sse (built-in MCP endpoint)
                                                  ^
Frontend (Next.js :3000)  ──rewrite /api/*──>  Backend    AI Agent (SSE transport)
```

- **CLI** is the primary interface for both humans and agents. Handles auth, push, install, search, scan, source management.
- **Backend** is a stateless REST API server. Stores metadata in PostgreSQL, artifacts in S3. Issues JWT tokens (HS256, 7-day expiry).
- **Frontend** is a Next.js 15 dark-themed web UI with 17 pages. Server Components fetch data directly; Client Components use `/api/*` rewrite proxy. Includes web-based skill publishing at `/skills/publish`.
- **MCP Gateway** is built into the backend as SSE endpoints (`/mcp/sse`, `/mcp/message`), exposing 4 read-only tools (`search_skills`, `get_skill_info`, `list_namespaces`, `get_install_instructions`) for AI agents. No separate process required.

## 5. Core Domain Concepts

| Concept | Description | Scope |
|---|---|---|
| **Registry (Source)** | A backend instance URL. CLI manages multiple sources locally (`~/.skillhub/config.json`). Backend has no multi-source awareness. | CLI-side federation |
| **Namespace** | Organization/team isolation unit (e.g., `@frontend`). RBAC boundary with `maintainer`/`viewer` member roles. | Backend DB (`namespaces` + `ns_members`) |
| **Skill** | A packaged directory containing `SKILL.md` (YAML frontmatter: `name`, `description`). Physical form: `.tar.gz` stored in S3. | Backend DB (`skills`) + S3 |
| **Tag** | Version label (e.g., `latest`, `v1.0.0`). Each tag maps to one artifact in S3 with checksum. | Backend DB (`skill_tags`) |

## 6. Project Structure

```
packages/
  shared/     @skillhub/shared    - 6 interfaces, 6 constants, zero deps
  cli/        @skillhub/cli       - Binary: skillhub. 7 commands (source, auth, scan, push, install, update, search)
  backend/    @skillhub/backend   - Hono REST API. 4 route groups, 3 services, 3 RBAC middlewares
  frontend/   @skillhub/frontend  - Next.js 15 App Router. 17 pages, dark theme, standalone output, web publish
  mcp/        mcp-skillhub        - (Legacy, now integrated into backend) MCP Server. 4 read-only tools, SSE transport
docker/
  docker-compose.yml              - PostgreSQL 16 + MinIO + bucket init
  Dockerfile.backend              - 3-stage build, non-root runner, port 3001
  Dockerfile.frontend             - 3-stage build, standalone Next.js, port 3000
tests/
  e2e/test-full-flow.sh           - Bash E2E script (health, auth, RBAC, skills, CLI)
```

## 7. Key Design Decisions

- **Dual-mode CLI output:** TTY detection auto-switches between human-friendly (chalk + tables) and JSON output for agent consumption.
- **S3 presigned URLs for download:** Install downloads bypass the backend; CLI fetches directly from S3 via presigned URL (1h expiry), reducing backend load.
- **SHA256 integrity:** Checksum computed on push (CLI), stored in DB, verified on install (CLI). End-to-end artifact integrity.
- **Agent-aware symlinks:** `install` auto-detects `.claude/` or `.agents/` directories and creates symlinks into agent-specific skill paths.
- **Client-side federation:** Multi-registry is purely a CLI concept. Each backend instance is an independent registry. Auth tokens are keyed by source URL.
- **API Key system:** Users can create, list, revoke, and rotate API keys for programmatic access (CI/CD, automation) without relying on short-lived JWTs.
- **`@skillhub/shared` must build first:** All CI, Docker, and dev workflows enforce shared-first build order.
