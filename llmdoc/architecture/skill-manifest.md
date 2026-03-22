# Architecture of skill.json Manifest System

## 1. Identity

- **What it is:** A project manifest file (`skill.json`) that provides structured metadata for skill projects, analogous to `package.json` for npm.
- **Purpose:** Enables declarative skill project configuration with single-skill and workspace (multi-skill) modes, rich metadata, and file filtering. Backward-compatible with legacy SKILL.md-only projects.

## 2. Core Components

- `packages/shared/src/types.ts` (`SkillManifest`, `SkillManifestEntry`): TypeScript interfaces defining the manifest schema. `SkillManifest` is the root type; `SkillManifestEntry` describes each skill in workspace mode.
- `packages/cli/src/lib/manifest.ts` (`loadManifest`): Reads and validates `skill.json` from a directory. Returns `null` if file absent (triggering legacy mode). Validates `name` (required), `namespace` (regex), `description` (required in single mode), and workspace entries.
- `packages/cli/src/commands/init.ts` (`registerInitCommand`): Scaffolds new projects. `--workspace` creates multi-skill layout; default creates single-skill layout with `skill.json` + `SKILL.md`.
- `packages/cli/src/commands/push.ts` (`pushSkill`, `pushSingle`, `pushWorkspace`, `pushLegacy`): Three-mode publish dispatch based on manifest presence. Extracts metadata fields for backend persistence.
- `packages/cli/src/commands/scan.ts` (`scanDirectory`): Priority-based validation: `skill.json` workspace > `skill.json` single > legacy SKILL.md glob traversal.

## 3. Execution Flow (LLM Retrieval Map)

### 3a. Manifest Resolution (used by push, scan)

- **1.** `loadManifest(dir)` reads `<dir>/skill.json` via `fs.readFile` (`packages/cli/src/lib/manifest.ts:7-39`).
- **2.** If file missing, returns `null` -- caller falls back to legacy SKILL.md mode.
- **3.** Validates: `name` required; `namespace` must match `/^@[a-z0-9][a-z0-9-]*$/`; in single mode `description` required; in workspace mode each entry needs `path`, `name`, `description`.
- **4.** Returns typed `SkillManifest` object.

### 3b. Push Mode Selection

- **1.** `pushSkill` in `packages/cli/src/commands/push.ts:74-98` calls `loadManifest(cwd)`.
- **2.** If `manifest.skills` exists: `pushWorkspace` iterates entries, packs each subdirectory, uploads individually.
- **3.** If `manifest` exists (no `skills`): `pushSingle` resolves namespace/name/tag from manifest, sends metadata (`author`, `license`, `repository`, `agents`, `tags`, `dependencies`).
- **4.** If no manifest: `pushLegacy` requires explicit `@ns/name` ref, reads SKILL.md frontmatter.
- **5.** Tag resolution: explicit `-t` flag > `manifest.version` > `latest`.

### 3c. Init Scaffolding

- **1.** `skillr init` in `packages/cli/src/commands/init.ts:17-58`.
- **2.** `--workspace`: Creates `skill.json` with `skills` array + `skills/example/SKILL.md`.
- **3.** Default (single): Creates `skill.json` with `name`, `description`, `version`, `namespace`, `agents` + root `SKILL.md`.

## 4. Design Rationale

- **Backward compatibility:** All CLI commands (scan, push) check for `skill.json` first, then fall back to SKILL.md-only mode. No breaking changes for existing projects.
- **Version-to-tag mapping:** `manifest.version` auto-maps to the publish tag, so `skillr push` without `-t` publishes at the version specified in `skill.json`.
- **Workspace mode:** Enables monorepo-style projects where multiple skills share common metadata (`author`, `license`, `namespace`) while maintaining per-skill `SKILL.md` content.
- **`files` field:** `include`/`exclude` glob arrays control what gets packed into the tarball, similar to npm's `files` field.
