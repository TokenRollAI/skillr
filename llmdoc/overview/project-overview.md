# Skillr - AI Agent Skill Registry

## 1. Identity

- **What it is:** An enterprise-grade skill aggregation and distribution platform for AI coding agents (Claude Code, Codex, OpenClaw) -- the "DockerHub + NPM" for AI Agent skills.
- **Purpose:** Provides unified discovery, publishing, installation, and reuse of AI agent skills following the Open Agent Skills Standard.

## 2. High-Level Description

Skillr enables developers and AI agents to publish, discover, and install packaged skill directories (`.tar.gz` containing a `SKILL.md` manifest). The system supports multi-registry federation (client-side, similar to Homebrew taps), namespace-based RBAC with three-tier visibility (`public`/`internal`/`private`), OAuth Device Code authentication for humans, API Key system for programmatic access, and environment-variable token injection for machines/agents. A dual-mode CLI outputs human-friendly or machine-parseable (JSON) responses based on TTY detection. Skills can also be published via the web UI at `/skills/publish` for non-technical users. The backend uses a Runtime Adapter Pattern to support both Node.js (Docker) and Cloudflare Workers (D1 + R2) deployments.

## 3. Tech Stack

| Layer | Technology | Package |
|---|---|---|
| Monorepo | pnpm workspaces, TypeScript (ES2022, strict) | root `pnpm-workspace.yaml` |
| Shared types | TypeScript interfaces + constants, zero deps | `packages/shared` (`@skillr/shared`) |
| CLI | Commander.js v13, chalk, cli-table3, fast-glob, gray-matter, tar | `packages/cli` (`@skillr/cli`) |
| Backend API | Hono v4, Drizzle ORM v0.39, jose (JWT), @hono/node-server | `packages/backend` (`@skillr/backend`) |
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS v4, zustand, lucide-react | `packages/frontend` (`@skillr/frontend`) |
| MCP Gateway | Dual-mode: standalone `@skillr/mcp` (stdio) + backend built-in `/mcp/sse` (SSE) | `packages/mcp` + `packages/backend` |
| Database | PostgreSQL 16 (postgres.js) or Cloudflare D1 (SQLite) | `docker/docker-compose.yml` / `wrangler.toml` |
| Object Storage | MinIO/S3-compatible (Node.js) or Cloudflare R2 (Workers) | `docker/docker-compose.yml` / `wrangler.toml` |
| Password Hashing | argon2 (Node.js) or Web Crypto PBKDF2 (Workers) | Runtime Adapter |
| Runtime | Cloudflare Workers or Node.js via Runtime Adapter Pattern | `packages/backend/src/runtime/` |
| CI/CD | GitHub Actions (lint, typecheck, unit test, build, docker validate) | `.github/workflows/ci.yml` |

## 4. Architecture Overview

```
CLI (skillr)  ──HTTP/REST──>  Backend (Hono :3001)  ──>  PostgreSQL / D1
       |                              |
       |                              ├──>  MinIO/S3 / R2 (artifacts)
       |                              |          ^
       └──S3 presigned URL (download)─┘──────────┘
                                      |
                                      └──>  /mcp/sse (built-in MCP endpoint)
                                                  ^
Frontend (Next.js :3000)  ──rewrite /api/*──>  Backend    AI Agent (SSE transport)

@skillr/mcp (stdio)  ──HTTP──>  Backend   (standalone MCP for Claude Desktop etc.)
```

- **CLI** (`skillr`) is the primary interface for both humans and agents. Handles auth, push, install, search, scan, source management.
- **Backend** is a stateless REST API server. Stores metadata in PostgreSQL/D1, artifacts in S3/R2. Issues JWT tokens (HS256, 7-day expiry). Entry: `entry-node.ts` (Node) or `entry-worker.ts` (CF Workers); `index.ts` only exports the Hono app.
- **Frontend** is a Next.js 15 dark-themed web UI with 17 pages. Server Components fetch data directly; Client Components use `/api/*` rewrite proxy. Includes web-based skill publishing at `/skills/publish`.
- **MCP Gateway** dual-mode: (1) built into the backend as SSE endpoints (`/mcp/sse`, `/mcp/message`), (2) standalone `@skillr/mcp` package for stdio transport. Both expose 4 read-only tools (`search_skills`, `get_skill_info`, `list_namespaces`, `get_install_instructions`).
- **Runtime Adapter** (`src/runtime/`): abstracts platform differences -- `PasswordHasher` and `StorageAdapter` interfaces allow swapping between Node.js (argon2 + S3 Client) and CF Workers (PBKDF2 + R2).

## 5. Core Domain Concepts

| Concept | Description | Scope |
|---|---|---|
| **Registry (Source)** | A backend instance URL. CLI manages multiple sources locally (`~/.skillr/config.json`). Backend has no multi-source awareness. | CLI-side federation |
| **Namespace** | Organization/team isolation unit (e.g., `@frontend`). RBAC boundary with `maintainer`/`viewer` member roles. Visibility: `public`/`internal`/`private`. | Backend DB (`namespaces` + `ns_members`) |
| **Skill** | A packaged directory containing `SKILL.md` (YAML frontmatter: `name`, `description`). Physical form: `.tar.gz` stored in S3/R2. | Backend DB (`skills`) + S3/R2 |
| **Tag** | Version label (e.g., `latest`, `v1.0.0`). Each tag maps to one artifact in S3/R2 with checksum. | Backend DB (`skill_tags`) |
| **API Key** | Programmatic access credential (`sk_live_<hex>`). Created/revoked/rotated via API. Used for CI/CD and automation. | Backend DB (`api_keys`) |

## 6. Project Structure

```
packages/
  shared/     @skillr/shared    - 6 interfaces, 6 constants, zero deps
  cli/        @skillr/cli       - Binary: skillr. 8 commands (login, source, auth, scan, push, install, update, search)
  backend/    @skillr/backend   - Hono REST API. 7 route groups, services, RBAC middlewares
    src/runtime/                - Runtime Adapter Pattern
      types.ts                 - PasswordHasher, StorageAdapter interfaces
      node.ts                  - argon2 + S3 Client implementation
      worker.ts                - PBKDF2 + R2 implementation
      index.ts                 - setRuntime/getRuntime global registry
    src/entry-node.ts          - Node.js entry point (@hono/node-server)
    src/entry-worker.ts        - Cloudflare Workers entry point
  frontend/   @skillr/frontend  - Next.js 15 App Router. 17 pages, dark theme, standalone output, web publish
  mcp/        @skillr/mcp       - Standalone MCP Server (stdio). 4 read-only tools
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
- **API Key system:** Users can create, list, revoke, and rotate API keys (`sk_live_*`) for programmatic access (CI/CD, automation) without relying on short-lived JWTs.
- **Runtime Adapter Pattern:** Abstracts platform-specific concerns (password hashing, storage) behind interfaces, enabling dual deployment on Docker (Node.js) and Cloudflare Workers (D1 + R2).
- **`@skillr/shared` must build first:** All CI, Docker, and dev workflows enforce shared-first build order.
