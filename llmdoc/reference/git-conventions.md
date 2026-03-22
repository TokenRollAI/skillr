# Git & CI Conventions

This document provides a summary of the project's branching strategy, commit conventions, and CI pipeline.

## 1. Core Summary

Skillr uses a single `main` branch as the integration target. CI runs on every push to `main` and on every pull request targeting `main`. The pipeline enforces typecheck, unit tests, and full build before merge. No Docker validation (Docker support has been removed).

## 2. Branch Strategy

- **Primary branch:** `main`
- **PR workflow:** Feature branches are merged into `main` via pull requests. CI must pass before merge.

## 3. Commit Message Format

The project uses Conventional Commits style (e.g., `feat:`, `fix:`, `chore:`, `docs:`). Adopt a descriptive imperative-mood style (e.g., "feat: add skill search endpoint").

## 4. CI Pipeline

Defined in `.github/workflows/ci.yml`. Triggers: `push` to `main`, `pull_request` to `main`.

| Job                  | Depends On                         | Key Steps                                                        |
| -------------------- | ---------------------------------- | ---------------------------------------------------------------- |
| `lint-and-typecheck` | --                                 | `pnpm install`, build `@skillr/shared`, typecheck `@skillr/api`, `@skillr/cli`   |
| `unit-test`          | --                                 | `pnpm install`, build `@skillr/shared`, test `@skillr/cli`, `@skillr/mcp`       |
| `build`              | `lint-and-typecheck`, `unit-test`  | Build: shared, cli, mcp, web          |

**Execution order:** `lint-and-typecheck` and `unit-test` run in parallel, then `build`.

**Toolchain:** pnpm 10, Node.js 22, `--frozen-lockfile` enforced.

## 5. Source of Truth

- **CI Workflow:** `.github/workflows/ci.yml` -- Full pipeline definition.
- **Root Scripts:** `package.json` -- Monorepo-level commands.
- **Backend Config:** `apps/api/wrangler.toml` -- Worker deployment configuration.
- **Frontend Config:** `apps/web/wrangler.toml` -- Workers Static Assets configuration.
