# Coding Conventions

This document provides a high-level summary of the coding standards, tooling choices, and architectural patterns enforced across the Skillr monorepo.

## 1. Core Summary

Skillr is a TypeScript-strict, ESM-only pnpm monorepo with a Cloudflare-First backend. The monorepo uses `apps/` for deployable services and `packages/` for shared libraries. Backend builds are handled directly by `wrangler` (no tsup). Tests use Vitest with globals enabled. The CLI layer enforces `process.exitCode` (never `process.exit`) and abstracts output via `OutputAdapter`. The backend follows a service-layer pattern with Hono routes delegating to pure service functions. Per-request initialization from Worker bindings replaces the old Runtime Adapter Pattern.

## 2. Source of Truth

- **TypeScript base config:** `tsconfig.base.json` - strict mode, ES2022 target, Node16 module/moduleResolution, isolatedModules.
- **Package manager:** `pnpm-workspace.yaml` - workspace packages under `apps/*` and `packages/*`.
- **Root scripts:** `package.json` - `pnpm -r build/test/typecheck`.
- **Backend:** `apps/api/` - wrangler handles TS compilation directly. No tsup.
- **CLI build:** `packages/cli/tsup.config.ts` - ESM format, node18 target.
- **MCP build:** `packages/mcp/tsup.config.ts` - ESM format, node18 target.
- **Frontend:** `apps/web/` - Next.js static export (`next build`), deployed via CF Workers Static Assets.
- **Shared:** `packages/shared/` - Plain `tsc` producing `.js` + `.d.ts` in `dist/`.
- **Vitest configs:** `packages/{cli,mcp}/vitest.config.ts` - globals: true, tests in `tests/**/*.test.ts`.
- **OutputAdapter pattern:** `packages/cli/src/lib/output.ts` (`OutputAdapter`, `TtyOutput`, `JsonOutput`, `createOutput`).
- **RegistryClient pattern:** `packages/cli/src/lib/registry-client.ts` (`RegistryClient`).
- **Service layer example:** `apps/api/src/services/skill.service.ts`.
- **Shared types:** `packages/shared/src/types.ts` - domain types, API response types, CLI config interfaces.

## 3. Convention Details

### TypeScript
- Strict mode enabled globally (`tsconfig.base.json`). All packages extend it except frontend (Next.js-specific config).
- ESM only: every `package.json` sets `"type": "module"`. Imports use `.js` extensions.
- Module resolution: `Node16` for cli/mcp/shared; `bundler` for frontend.

### Package Management
- pnpm workspaces with `workspace:*` protocol for internal deps.
- Five packages across two directories: `apps/api`, `apps/web`, `packages/shared`, `packages/cli`, `packages/mcp`.

### Build
- **Backend (API):** wrangler compiles TypeScript directly. No bundler config needed.
- **CLI / MCP:** tsup - ESM format, node18 target.
- **Frontend:** Next.js static export (`next build` produces `out/`).
- **Shared:** Plain `tsc` producing `.js` + `.d.ts` in `dist/`.

### Testing
- Vitest with `globals: true` (no need to import `describe`/`it`/`expect`).
- Test files: `tests/**/*.test.ts` pattern in each package.
- Filesystem isolation: tests use `mkdtemp` + `tmpdir()` for temp dirs, cleaned in `afterEach`.
- Fetch mocking: save/restore `globalThis.fetch` in `beforeEach`/`afterEach`.

### Code Patterns
- **Service layer:** Backend routes (`apps/api/src/routes/`) delegate to service modules (`apps/api/src/services/`).
- **Per-request initialization:** Middleware in `index.ts` sets globals (DB, R2 bucket, env) from Worker bindings on every request.
- **OutputAdapter:** CLI commands accept an `OutputAdapter` interface for testable, format-agnostic output.
- **RegistryClient:** Encapsulates all HTTP calls to the backend API.

### Naming
- **Files:** `kebab-case` (e.g., `registry-client.ts`, `skill.service.ts`, `audit-log.ts`).
- **Variables/functions:** `camelCase` (e.g., `getSkillTag`, `createOutput`, `pushSkill`).
- **Types/interfaces/classes:** `PascalCase` (e.g., `RegistryClient`, `OutputAdapter`, `SkillrConfig`).

### Error Handling
- **CLI:** Always `process.exitCode = 1` + `return`, never `process.exit()`.
- **Backend API:** JSON error responses with `{ error: string }` body and appropriate HTTP status codes (400, 401, 403, 404, 413).
