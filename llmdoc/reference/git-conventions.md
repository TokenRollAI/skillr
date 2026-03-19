# Git & CI Conventions

This document provides a summary of the project's branching strategy, commit conventions, and CI pipeline.

## 1. Core Summary

Skillhub uses a single `main` branch as the integration target. CI runs on every push to `main` and on every pull request targeting `main`. The pipeline enforces typecheck, unit tests, full build, and Docker validation before merge.

## 2. Branch Strategy

- **Primary branch:** `main`
- **PR workflow:** Feature branches are merged into `main` via pull requests. CI must pass before merge.
- **No long-lived secondary branches** are observed in the repository history.

## 3. Commit Message Format

The project has a single initial commit (`f8071c7 Initial commit`). No enforced commit message convention (e.g., Conventional Commits) is configured via tooling. Adopt a descriptive imperative-mood style (e.g., "Add skill search endpoint").

## 4. CI Pipeline

Defined in `.github/workflows/ci.yml`. Triggers: `push` to `main`, `pull_request` to `main`.

| Job                  | Depends On                         | Key Steps                                                        |
| -------------------- | ---------------------------------- | ---------------------------------------------------------------- |
| `lint-and-typecheck` | —                                  | `pnpm install`, build `@skillhub/shared`, typecheck backend, cli |
| `unit-test`          | —                                  | `pnpm install`, build `@skillhub/shared`, test cli, test mcp     |
| `build`              | `lint-and-typecheck`, `unit-test`  | Build all packages: shared, backend, cli, mcp, frontend          |
| `docker`             | `build`                            | Validate `docker compose -f docker/docker-compose.yml config`    |

**Execution order:** `lint-and-typecheck` and `unit-test` run in parallel, then `build`, then `docker`.

**Toolchain:** pnpm 10, Node.js 22, `--frozen-lockfile` enforced.

## 5. Source of Truth

- **CI Workflow:** `.github/workflows/ci.yml` — Full pipeline definition.
- **Root Scripts:** `package.json` (`dev:infra`, `build`, `test`, `typecheck`) — Monorepo-level commands.
- **Docker Config:** `docker/docker-compose.yml`, `docker/Dockerfile.backend`, `docker/Dockerfile.frontend`.
