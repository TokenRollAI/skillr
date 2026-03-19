# Architecture of CLI Command System

## 1. Identity

- **What it is:** The `skillhub` CLI built on Commander.js v13, providing 7 top-level commands for skill registry operations.
- **Purpose:** Enables developers and AI agents to manage skill sources, authenticate, scan/push/install/search skills from the terminal.

## 2. Core Components

- `packages/cli/src/index.ts` (`program`): Entry point. Creates root `Command`, registers `--json` global option, calls all 7 register functions, then `program.parse()`.
- `packages/cli/src/lib/config.ts` (`loadConfig`, `saveConfig`, `getAuthToken`, `getDefaultSource`, `getConfigDir`): Config management at `~/.skillhub/config.json`. Atomic writes via rename-from-temp. Token resolution: `SKILLHUB_TOKEN` env > `config.auth[url].token`.
- `packages/cli/src/lib/output.ts` (`OutputAdapter`, `TtyOutput`, `JsonOutput`, `createOutput`): Dual-mode output abstraction. `createOutput()` selects `JsonOutput` when `--json` flag is set OR `!process.stdout.isTTY`; otherwise `TtyOutput`.
- `packages/cli/src/lib/registry-client.ts` (`RegistryClient`): HTTP client over native `fetch`. Shared `request<T>()` for JSON endpoints; `pushSkill()` bypasses it for multipart/form-data.
- `packages/cli/src/lib/symlink.ts` (`detectAgentEnv`, `getSymlinkTarget`, `createSkillSymlink`): Detects `.claude/` or `.agents/` dirs to determine agent environment, creates symlinks from cache into agent skill directories.
- `packages/cli/src/commands/source.ts` (`registerSourceCommands`): `source list|add|remove|set-default` -- purely local config, no `RegistryClient`.
- `packages/cli/src/commands/auth.ts` (`registerAuthCommands`, `loginFlow`): `auth login|logout|whoami|status` -- OAuth 2.0 Device Code flow with configurable poll interval.
- `packages/cli/src/commands/scan.ts` (`registerScanCommand`, `scanDirectory`): `scan [dir]` -- finds `SKILL.md` files via `fast-glob`, validates YAML frontmatter.
- `packages/cli/src/commands/push.ts` (`registerPushCommand`, `pushSkill`): `push <ref>` -- packs CWD as tarball, computes sha256, uploads via `RegistryClient.pushSkill`.
- `packages/cli/src/commands/install.ts` (`registerInstallCommand`, `registerUpdateCommand`, `installSkill`): `install <ref>` and `update [ref]` -- downloads, verifies checksum, extracts to cache, symlinks, records in `installed.json`.
- `packages/cli/src/commands/search.ts` (`registerSearchCommand`, `searchSkills`): `search <query>` -- calls `RegistryClient.searchSkills`, renders results table.

## 3. Execution Flow (LLM Retrieval Map)

### Command Registration (startup)

- **1.** `packages/cli/src/index.ts:9-15` creates root `Command('skillhub')` with `--json` global option.
- **2.** `packages/cli/src/index.ts:17-23` calls each `register*` function, which attach subcommands to the program.
- **3.** `packages/cli/src/index.ts:25` calls `program.parse()` to execute.

### Command Execution Pattern (all commands)

- **1.** Commander invokes the action handler with parsed args/opts.
- **2.** Handler calls `createOutput({ json: program.opts().json })` (`packages/cli/src/lib/output.ts:76-81`) to select output mode.
- **3.** Handler delegates to an exported business-logic function (e.g., `installSkill`, `pushSkill`).
- **4.** Business-logic function calls `loadConfig()` then `getDefaultSource()` then `getAuthToken()` (`packages/cli/src/lib/config.ts`).
- **5.** Instantiates `new RegistryClient(source.url, token)` and calls the appropriate API method.
- **6.** On error, sets `process.exitCode = 1` (never calls `process.exit()`).

### Smart Install Resolution

- **1.** `packages/cli/src/commands/install.ts:54-56` tries `@namespace/name` regex match.
- **2.** `packages/cli/src/commands/install.ts:59-111` on bare name: searches via `client.searchSkills`, filters exact name matches, handles ambiguity.
- **3.** `packages/cli/src/commands/install.ts:131-170` fetches tag info, downloads from signed URL, verifies sha256, extracts to `~/.skillhub/cache/`.
- **4.** `packages/cli/src/commands/install.ts:175-183` detects agent env and creates symlink if applicable.

## 4. Design Rationale

- **Dual output** enables the same CLI binary to serve both human developers (TTY) and AI agents (JSON). `JsonOutput.error()` writes to `stdout` (not `stderr`) so all JSON output is on a single stream.
- **`configDir` parameter** on all business-logic functions is the primary testability hook -- tests pass a temp directory for filesystem isolation.
- **`process.exitCode` over `process.exit()`** allows clean test execution without killing the process.
- **`pushSkill` bypasses shared `request()`** because multipart/form-data requires different headers (no `Content-Type: application/json`).
