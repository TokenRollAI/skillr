# Coding Conventions

This document provides a high-level summary of the coding standards, tooling choices, and architectural patterns enforced across the Skillr monorepo.

## 1. Core Summary

Skillr is a TypeScript-strict, ESM-only pnpm monorepo targeting Node 18+. Build tooling varies by package (tsup for CLI/Backend/MCP, Next.js for frontend, plain tsc for shared). Tests use Vitest with globals enabled. The CLI layer enforces `process.exitCode` (never `process.exit`) and abstracts output via `OutputAdapter`. The backend follows a service-layer pattern with Hono routes delegating to pure service functions. The Runtime Adapter Pattern abstracts platform differences for dual deployment (Node.js + CF Workers).

## 2. Source of Truth

- **TypeScript base config:** `tsconfig.base.json` - strict mode, ES2022 target, Node16 module/moduleResolution, isolatedModules.
- **Package manager:** `pnpm-workspace.yaml` - workspace packages under `packages/*`.
- **Root scripts:** `package.json` - `pnpm -r build/test/typecheck`, e2e via bash script.
- **Build configs:** `packages/backend/tsup.config.ts`, `packages/cli/tsup.config.ts`, `packages/mcp/tsup.config.ts` - ESM format, node18 target.
- **Frontend tsconfig:** `packages/frontend/tsconfig.json` - bundler moduleResolution, Next.js plugin, `@/*` path alias.
- **Vitest configs:** `packages/{backend,cli,mcp}/vitest.config.ts` - globals: true, tests in `tests/**/*.test.ts`.
- **OutputAdapter pattern:** `packages/cli/src/lib/output.ts` (`OutputAdapter`, `TtyOutput`, `JsonOutput`, `createOutput`).
- **RegistryClient pattern:** `packages/cli/src/lib/registry-client.ts` (`RegistryClient`).
- **Runtime Adapter:** `packages/backend/src/runtime/` (`types.ts`, `node.ts`, `worker.ts`, `index.ts`).
- **Service layer example:** `packages/backend/src/services/skill.service.ts`.
- **Shared types:** `packages/shared/src/types.ts` - canonical TypeScript interfaces for cross-package contracts.

## 3. Convention Details

### TypeScript
- Strict mode enabled globally (`tsconfig.base.json`). All packages extend it except frontend (Next.js-specific config).
- ESM only: every `package.json` sets `"type": "module"`. Imports use `.js` extensions.
- Module resolution: `Node16` for backend/cli/mcp/shared; `bundler` for frontend.

### Package Management
- pnpm workspaces with `workspace:*` protocol for internal deps (e.g., `"@skillr/shared": "workspace:*"`).
- Five packages: `backend`, `cli`, `frontend`, `mcp`, `shared`.

### Build
- **CLI / Backend / MCP:** tsup - ESM format, node18 target.
- **Backend entry points:** `entry-node.ts` (Node.js/Docker), `entry-worker.ts` (CF Workers). `index.ts` only exports the Hono app.
- **Frontend:** Next.js (`next build`).
- **Shared:** Plain `tsc` producing `.js` + `.d.ts` in `dist/`.

### Testing
- Vitest with `globals: true` (no need to import `describe`/`it`/`expect`).
- Test files: `tests/**/*.test.ts` pattern in each package.
- Filesystem isolation: tests use `mkdtemp` + `tmpdir()` for temp dirs, cleaned in `afterEach`.
- Fetch mocking: save/restore `globalThis.fetch` in `beforeEach`/`afterEach`.

### Code Patterns
- **Service layer:** Backend routes (`packages/backend/src/routes/`) delegate to service modules (`packages/backend/src/services/`).
- **OutputAdapter:** CLI commands accept an `OutputAdapter` interface for testable, format-agnostic output.
- **RegistryClient:** Encapsulates all HTTP calls to the backend API.
- **Runtime Adapter Pattern:** `packages/backend/src/runtime/types.ts` defines `PasswordHasher` and `StorageAdapter` interfaces. `runtime/node.ts` provides argon2 + S3 implementations; `runtime/worker.ts` provides PBKDF2 + R2 implementations. `setRuntime()`/`getRuntime()` in `runtime/index.ts` manage the global instance.

### Naming
- **Files:** `kebab-case` (e.g., `registry-client.ts`, `skill.service.ts`, `audit-log.ts`).
- **Variables/functions:** `camelCase` (e.g., `getSkillTag`, `createOutput`, `pushSkill`).
- **Types/interfaces/classes:** `PascalCase` (e.g., `RegistryClient`, `OutputAdapter`, `SkillrConfig`).

### Error Handling
- **CLI:** Always `process.exitCode = 1` + `return`, never `process.exit()`. The sole exception is `packages/backend/src/env.ts` for fatal startup errors.
- **Backend API:** JSON error responses with `{ error: string }` body and appropriate HTTP status codes (400, 401, 403, 404, 413).
