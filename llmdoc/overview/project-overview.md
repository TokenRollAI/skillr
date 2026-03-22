# Skillr - AI Agent Skill Registry

## 1. Identity

- **What it is:** An enterprise-grade skill aggregation and distribution platform for AI coding agents (Claude Code, Codex, OpenClaw) -- the "DockerHub + NPM" for AI Agent skills.
- **Purpose:** Provides unified discovery, publishing, installation, and reuse of AI agent skills following the Open Agent Skills Standard.

## 2. High-Level Description

Skillr enables developers and AI agents to publish, discover, and install packaged skill directories (`.tar.gz` containing a `SKILL.md` manifest). Projects are described by a `skill.json` manifest file (similar to `package.json`) supporting single-skill mode (one skill per directory) and workspace mode (multiple skills in subdirectories). Legacy `SKILL.md` frontmatter mode remains supported for backward compatibility. The system supports multi-registry federation (client-side, similar to Homebrew taps), namespace-based RBAC with three-tier visibility (`public`/`internal`/`private`), OAuth Device Code authentication for humans, API Key system for programmatic access, and environment-variable token injection for machines/agents. A dual-mode CLI outputs human-friendly or machine-parseable (JSON) responses based on TTY detection. Skills can also be published via the web UI at `/skills/publish` for non-technical users. The backend is Cloudflare-First: deployed exclusively on CF Workers with D1 (SQLite) and R2 storage.

## 3. Tech Stack

| Layer | Technology | Package |
|---|---|---|
| Monorepo | pnpm workspaces, TypeScript (ES2022, strict) | root `pnpm-workspace.yaml` (`apps/*` + `packages/*`) |
| Shared types | TypeScript interfaces + constants, zero deps | `packages/shared` (`@skillr/shared`) |
| CLI | Commander.js v13, chalk, cli-table3, fast-glob, gray-matter, tar | `packages/cli` (`@skillr/cli`) |
| Backend API | Hono v4, Drizzle ORM v0.39 (SQLite), jose (JWT), wrangler | `apps/api` (`@skillr/api`) |
| Frontend | Next.js 15 (App Router, static export), React 19, Tailwind CSS v4, zustand, lucide-react | `apps/web` (`@skillr/web`) |
| MCP Gateway | Dual-mode: standalone `@skillr/mcp` (stdio) + backend built-in `/mcp/sse` (SSE) | `packages/mcp` + `apps/api` |
| Database | Cloudflare D1 (SQLite) | `apps/api/wrangler.toml` |
| Object Storage | Cloudflare R2 | `apps/api/wrangler.toml` |
| Password Hashing | Web Crypto PBKDF2 | `apps/api/src/lib/password.ts` |
| Runtime | Cloudflare Workers (single runtime, no adapter) | `apps/api/src/index.ts` |
| CI/CD | GitHub Actions (lint, typecheck, unit test, build) | `.github/workflows/ci.yml` |

## 4. Architecture Overview

```
CLI (skillr)  ──HTTP/REST──>  Backend (CF Workers, Hono)  ──>  D1 (SQLite)
       |                              |
       |                              ├──>  R2 (artifacts)
       |                              |          ^
       └──R2 download proxy───────────┘──────────┘
                                      |
                                      └──>  /mcp/sse (built-in MCP endpoint)
                                                  ^
Frontend (CF Workers Static Assets)  ──rewrite /api/*──>  Backend    AI Agent (SSE transport)

@skillr/mcp (stdio)  ──HTTP──>  Backend   (standalone MCP for Claude Desktop etc.)
```

- **CLI** (`skillr`) is the primary interface for both humans and agents. Handles auth, push, install, search, scan, init, source management. Supports `skill.json` manifest for project metadata.
- **Backend** is a stateless REST API on CF Workers. Stores metadata in D1, artifacts in R2. Issues JWT tokens (HS256, 7-day expiry). Single entry point: `apps/api/src/index.ts` exports the Hono app as default Worker. Per-request initialization middleware sets DB, R2 bucket, and env globals.
- **Frontend** is a Next.js 15 static export served via CF Workers Static Assets. Dark-themed web UI with web-based skill publishing at `/skills/publish`.
- **MCP Gateway** dual-mode: (1) built into the backend as SSE endpoints (`/mcp/sse`, `/mcp/message`), (2) standalone `@skillr/mcp` package for stdio transport. Both expose 4 read-only tools.
- **No Runtime Adapter Pattern** -- the dual-runtime abstraction has been removed. All platform-specific code uses CF Workers APIs directly (Web Crypto PBKDF2, R2 binding, D1).

## 5. Core Domain Concepts

| Concept | Description | Scope |
|---|---|---|
| **Registry (Source)** | A backend instance URL. CLI manages multiple sources locally (`~/.skillr/config.json`). Backend has no multi-source awareness. | CLI-side federation |
| **Namespace** | Organization/team isolation unit (e.g., `@frontend`). RBAC boundary with `maintainer`/`viewer` member roles. Visibility: `public`/`internal`/`private`. | Backend DB (`namespaces` + `ns_members`) |
| **Skill** | A packaged directory containing `SKILL.md` (YAML frontmatter: `name`, `description`), optionally described by a `skill.json` manifest with rich metadata (`author`, `license`, `repository`, `agents`, `tags`, `dependencies`). Physical form: `.tar.gz` stored in R2. | Backend DB (`skills`) + R2 |
| **skill.json** | Project manifest file (like `package.json`). Two modes: single-skill (root `skill.json` + `SKILL.md`) or workspace (`skills` array pointing to subdirectories). Backward-compatible: absent `skill.json` falls back to `SKILL.md` frontmatter. | CLI-side (`packages/cli/src/lib/manifest.ts`) |
| **Tag** | Version label (e.g., `latest`, `v1.0.0`). Each tag maps to one artifact in R2 with checksum. | Backend DB (`skill_tags`) |
| **API Key** | Programmatic access credential (`sk_live_<hex>`). Created/revoked/rotated via API. Used for CI/CD and automation. | Backend DB (`api_keys`) |

## 6. Project Structure

```
apps/
  api/        @skillr/api       - CF Workers (Hono + D1 + R2). Single entry: src/index.ts
    src/lib/                    - Platform modules (password.ts, storage.ts)
  web/        @skillr/web       - CF Workers Static Assets (Next.js static export)
packages/
  shared/     @skillr/shared    - Domain types, API response types, constants, zero deps
  cli/        @skillr/cli       - Binary: skillr. 9 commands (login, source, auth, scan, push, install, update, search, init)
  mcp/        @skillr/mcp       - Standalone MCP Server (stdio). 4 read-only tools
tests/
  e2e/test-full-flow.sh         - Bash E2E script (health, auth, RBAC, skills, CLI)
```

## 7. Key Design Decisions

- **Cloudflare-First:** Single deployment target (CF Workers + D1 + R2). No Docker, no Node.js server, no runtime adapter pattern.
- **Per-request initialization:** Middleware in `index.ts` sets DB, R2 bucket, and env globals from Worker bindings on every request (safe in single-threaded Workers).
- **Dual-mode CLI output:** TTY detection auto-switches between human-friendly (chalk + tables) and JSON output for agent consumption.
- **R2 download proxy:** `GET /api/skills/download/:key` serves artifacts directly from R2 through the Worker (replaces presigned URLs).
- **SHA256 integrity:** Checksum computed on push (CLI), stored in DB, verified on install (CLI). End-to-end artifact integrity.
- **Agent-aware symlinks:** `install` auto-detects `.claude/` or `.agents/` directories and creates symlinks into agent-specific skill paths.
- **Client-side federation:** Multi-registry is purely a CLI concept. Each backend instance is an independent registry.
- **API Key system:** Users can create, list, revoke, and rotate API keys (`sk_live_*`) for programmatic access.
- **`@skillr/shared` must build first:** All CI and dev workflows enforce shared-first build order.
- **`skill.json` manifest:** Provides structured project metadata (like `package.json`). Supports single-skill and workspace modes. `version` field auto-maps to publish tag. Backward-compatible with SKILL.md-only projects.
