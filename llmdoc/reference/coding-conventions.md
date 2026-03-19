# Coding Conventions

This document provides a high-level summary of the coding standards, tooling choices, and architectural patterns enforced across the Skillhub monorepo.

## 1. Core Summary

Skillhub is a TypeScript-strict, ESM-only pnpm monorepo targeting Node 18+. Build tooling varies by package (tsup for CLI/Backend/MCP, Next.js for frontend, plain tsc for shared). Tests use Vitest with globals enabled. The CLI layer enforces `process.exitCode` (never `process.exit`) and abstracts output via `OutputAdapter`. The backend follows a service-layer pattern with Hono routes delegating to pure service functions.

## 2. Source of Truth

- **TypeScript base config:** `tsconfig.base.json` - strict mode, ES2022 target, Node16 module/moduleResolution, isolatedModules.
- **Package manager:** `pnpm-workspace.yaml` - workspace packages under `packages/*`.
- **Root scripts:** `package.json` - `pnpm -r build/test/typecheck`, e2e via bash script.
- **Build configs:** `packages/backend/tsup.config.ts`, `packages/cli/tsup.config.ts`, `packages/mcp/tsup.config.ts` - ESM format, node18 target.
- **Frontend tsconfig:** `packages/frontend/tsconfig.json` - bundler moduleResolution, Next.js plugin, `@/*` path alias.
- **Vitest configs:** `packages/{backend,cli,mcp}/vitest.config.ts` - globals: true, tests in `tests/**/*.test.ts`.
- **OutputAdapter pattern:** `packages/cli/src/lib/output.ts` (`OutputAdapter`, `TtyOutput`, `JsonOutput`, `createOutput`).
- **RegistryClient pattern:** `packages/cli/src/lib/registry-client.ts` (`RegistryClient`).
- **Service layer example:** `packages/backend/src/services/skill.service.ts` - pure functions operating on DB via drizzle-orm.
- **Shared types:** `packages/shared/src/types.ts` - canonical TypeScript interfaces for cross-package contracts.

## 3. Convention Details

### TypeScript
- Strict mode enabled globally (`tsconfig.base.json`). All packages extend it except frontend (Next.js-specific config).
- ESM only: every `package.json` sets `"type": "module"`. Imports use `.js` extensions.
- Module resolution: `Node16` for backend/cli/mcp/shared; `bundler` for frontend.

### Package Management
- pnpm workspaces with `workspace:*` protocol for internal deps (e.g., `"@skillhub/shared": "workspace:*"`).
- Five packages: `backend`, `cli`, `frontend`, `mcp`, `shared`.

### Build
- **CLI / Backend / MCP:** tsup - ESM format, node18 target, single `src/index.ts` entry.
- **Frontend:** Next.js (`next build`).
- **Shared:** Plain `tsc` producing `.js` + `.d.ts` in `dist/`.

### Testing
- Vitest with `globals: true` (no need to import `describe`/`it`/`expect`, though many files still do).
- Test files: `tests/**/*.test.ts` pattern in each package.
- Filesystem isolation: tests use `mkdtemp` + `tmpdir()` for temp dirs, cleaned in `afterEach`. See `packages/cli/tests/unit/config.test.ts`.
- Fetch mocking: save/restore `globalThis.fetch` in `beforeEach`/`afterEach`. See `packages/cli/tests/unit/registry-client.test.ts:5-22`.

### Code Patterns
- **Service layer:** Backend routes (`packages/backend/src/routes/`) delegate to service modules (`packages/backend/src/services/`). Routes handle HTTP concerns; services handle business logic and DB access.
- **OutputAdapter:** CLI commands accept an `OutputAdapter` interface for testable, format-agnostic output. `createOutput()` selects `TtyOutput` or `JsonOutput` based on `--json` flag / TTY detection.
- **RegistryClient:** Encapsulates all HTTP calls to the backend API. Constructor takes `baseUrl` and optional `token`. Used by CLI commands for auth, push, install, search.

### Naming
- **Files:** `kebab-case` (e.g., `registry-client.ts`, `skill.service.ts`, `audit-log.ts`).
- **Variables/functions:** `camelCase` (e.g., `getSkillTag`, `createOutput`, `pushSkill`).
- **Types/interfaces/classes:** `PascalCase` (e.g., `RegistryClient`, `OutputAdapter`, `SkillhubConfig`).

### Error Handling
- **CLI:** Always `process.exitCode = 1` + `return`, never `process.exit()`. This allows graceful cleanup and is testable (tests assert `process.exitCode` value). The sole exception is `packages/backend/src/env.ts` which uses `process.exit(1)` for fatal startup config errors.
- **Backend API:** JSON error responses with `{ error: string }` body and appropriate HTTP status codes (400, 401, 403, 404, 413).
