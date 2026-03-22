# Architecture of CLI Command System

## 1. Identity

- **What it is:** The `skillr` CLI built on Commander.js v13, providing 9 top-level commands for skill registry operations.
- **Purpose:** Enables developers and AI agents to manage skill sources, authenticate, scan/push/install/search skills from the terminal.

## 2. Core Components

- `packages/cli/src/index.ts` (`program`): Entry point. Creates root `Command('skillr')` with `--json` global option, registers `login` as a top-level command, then all register functions, then `program.parse()`.
- `packages/cli/src/lib/config.ts` (`loadConfig`, `saveConfig`, `getAuthToken`, `getDefaultSource`, `getConfigDir`): Config management at `~/.skillr/config.json`. Atomic writes via rename-from-temp. Token resolution: `SKILLHUB_TOKEN` env > `config.auth[url].token`.
- `packages/cli/src/lib/output.ts` (`OutputAdapter`, `TtyOutput`, `JsonOutput`, `createOutput`): Dual-mode output abstraction. `createOutput()` selects `JsonOutput` when `--json` flag is set OR `!process.stdout.isTTY`; otherwise `TtyOutput`.
- `packages/cli/src/lib/registry-client.ts` (`RegistryClient`): HTTP client over native `fetch`. Shared `request<T>()` for JSON endpoints; `pushSkill()` bypasses it for multipart/form-data.
- `packages/cli/src/lib/manifest.ts` (`loadManifest`): Loads and validates `skill.json` from a directory. Returns `SkillManifest | null`. Validates required fields per mode (single vs workspace), namespace format regex.
- `packages/cli/src/lib/symlink.ts` (`detectAgentEnv`, `getSymlinkTarget`, `createSkillSymlink`): Detects `.claude/` or `.agents/` dirs to determine agent environment, creates symlinks from cache into agent skill directories.
- `packages/cli/src/commands/login.ts` (`registerLoginCommand`): Top-level `skillr login <url>` -- adds source and authenticates in one step. No default source URL.
- `packages/cli/src/commands/source.ts` (`registerSourceCommands`): `source list|add|remove|set-default` -- purely local config, no `RegistryClient`.
- `packages/cli/src/commands/auth.ts` (`registerAuthCommands`, `loginFlow`): `auth login|logout|whoami|status` -- OAuth 2.0 Device Code flow with configurable poll interval.
- `packages/cli/src/commands/scan.ts` (`registerScanCommand`, `scanDirectory`): `scan [dir]` -- prioritizes `skill.json` detection (workspace: validates each entry's SKILL.md; single: validates root); falls back to `fast-glob` SKILL.md traversal.
- `packages/cli/src/commands/push.ts` (`registerPushCommand`, `pushSkill`): `push [ref]` -- three modes: workspace (pushes all skills from `skill.json.skills`), single (`skill.json` name/namespace), legacy (`SKILL.md` frontmatter). Supports `files.include/exclude` filtering from manifest.
- `packages/cli/src/commands/install.ts` (`registerInstallCommand`, `registerUpdateCommand`, `installSkill`): `install <ref>` and `update [ref]` -- downloads, verifies checksum, extracts to cache, symlinks, records in `installed.json`.
- `packages/cli/src/commands/search.ts` (`registerSearchCommand`, `searchSkills`): `search <query>` -- calls `RegistryClient.searchSkills`, renders results table. Supports `--agent` and `--tag` filter options.
- `packages/cli/src/commands/init.ts` (`registerInitCommand`): `init` -- scaffolds a new skill project. Options: `--workspace` (multi-skill), `--name`, `--namespace`. Creates `skill.json` and template `SKILL.md`.

## 3. Execution Flow (LLM Retrieval Map)

### Command Registration (startup)

- **1.** `packages/cli/src/index.ts` creates root `Command('skillr')` with `--json` global option.
- **2.** Registers `login` as a top-level command (shortcut for `auth login` with URL argument).
- **3.** Calls each `register*` function, which attach subcommands to the program.
- **4.** Calls `program.parse()` to execute.

### Command Execution Pattern (all commands)

- **1.** Commander invokes the action handler with parsed args/opts.
- **2.** Handler calls `createOutput({ json: program.opts().json })` to select output mode.
- **3.** Handler delegates to an exported business-logic function (e.g., `installSkill`, `pushSkill`).
- **4.** Business-logic function calls `loadConfig()` then `getDefaultSource()` then `getAuthToken()` (`packages/cli/src/lib/config.ts`).
- **5.** Instantiates `new RegistryClient(source.url, token)` and calls the appropriate API method.
- **6.** On error, sets `process.exitCode = 1` (never calls `process.exit()`).

### Smart Install Resolution

- **1.** Tries `@namespace/name` regex match.
- **2.** On bare name: searches via `client.searchSkills`, filters exact name matches, handles ambiguity.
- **3.** Fetches tag info, downloads from signed URL, verifies sha256, extracts to `~/.skillr/cache/`.
- **4.** Detects agent env and creates symlink if applicable.

## 4. Design Rationale

- **Top-level `login` command** provides a streamlined first-use experience: `skillr login <url>` registers the source and authenticates in one step. No default source URL means the user must always specify where to connect.
- **Dual output** enables the same CLI binary to serve both human developers (TTY) and AI agents (JSON).
- **`configDir` parameter** on all business-logic functions is the primary testability hook.
- **`process.exitCode` over `process.exit()`** allows clean test execution.
