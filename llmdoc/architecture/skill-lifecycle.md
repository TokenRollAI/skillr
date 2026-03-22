# Architecture of Skill Lifecycle

## 1. Identity

- **What it is:** The end-to-end data flow of a Skill artifact through: scan, push, install, update, and search.
- **Purpose:** Serves as the LLM retrieval map for tracing how a Skill moves from local directory to registry to consumer project.

## 2. Core Components

- `packages/cli/src/lib/manifest.ts` (`loadManifest`): Loads `skill.json` manifest. Returns `SkillManifest | null` (null = legacy mode).
- `packages/cli/src/commands/scan.ts` (`scanDirectory`, `ScannedSkill`): Prioritizes `skill.json` detection; workspace mode validates each entry, single mode validates root, legacy falls back to SKILL.md traversal.
- `packages/cli/src/commands/push.ts` (`pushSkill`, `packDirectory`, `pushSingle`, `pushWorkspace`, `pushLegacy`): Three-mode publish: workspace, single, legacy. Tarball packing with `files.include/exclude`, SHA256 checksum, multipart upload via RegistryClient. Sends metadata (`author`, `license`, `repository`, `agents`, `tags`, `dependencies`).
- `packages/cli/src/commands/install.ts` (`installSkill`, `updateSkills`, `InstalledSkill`): Tag resolution, download, checksum verify, extraction, symlink, installed.json registry.
- `packages/cli/src/commands/search.ts` (`searchSkills`): CLI search entry point, delegates to RegistryClient.
- `packages/cli/src/lib/registry-client.ts` (`RegistryClient`): HTTP client wrapping all Backend API calls.
- `packages/cli/src/lib/symlink.ts` (`detectAgentEnv`, `getSymlinkTarget`, `createSkillSymlink`): Agent environment detection and symlink creation.
- `apps/api/src/routes/skills.ts` (`skillsRoutes`): Hono REST routes: POST push (multipart + JSON body), GET info/tags/tag/search, DELETE, GET download proxy.
- `apps/api/src/services/skill.service.ts` (`createOrUpdateSkill`, `getSkillTag`, `searchSkills`): Core business logic for push (persists `author`, `license`, `repository`, `agents`, `searchTags`, `dependencies`), download URL generation, and search. Supports `agentFilter` and `tagFilter` parameters. Auto-syncs `latest` tag on versioned publish. Uses `like` (SQLite).
- `apps/api/src/lib/storage.ts` (`uploadArtifact`, `downloadArtifact`, `deleteArtifact`): Direct R2 binding operations.
- `packages/mcp/src/index.ts` (standalone MCP Server, stdio): Read-only MCP gateway exposing `search_skills`, `get_skill_info`, `list_namespaces`, `get_install_instructions`.
- `apps/api/src/routes/mcp.ts` (built-in MCP, SSE): Same 4 tools, exposed via `/mcp/sse` endpoint.

## 3. Execution Flow (LLM Retrieval Map)

### 3a. Scan (local-only, no network)

- **1.** CLI invokes `scanDirectory(dir)` in `packages/cli/src/commands/scan.ts`.
- **1b.** Calls `loadManifest(dir)` from `packages/cli/src/lib/manifest.ts` to check for `skill.json`.
- **2a. Workspace mode** (`manifest.skills` exists): Iterates each skill entry, validates `SKILL.md` exists in `entry.path`, checks required fields from entry or frontmatter.
- **2b. Single mode** (`manifest` exists, no `skills`): Validates root `SKILL.md`, uses manifest fields for name/description/version.
- **2c. Legacy mode** (no `skill.json`): `fast-glob` traverses for `**/SKILL.md`, ignoring `node_modules`, `.git`, `dist`, `build`, `.next`, `coverage`, `.turbo`. Each file parsed with `gray-matter`.
- **3.** Returns `ScannedSkill[]` with `valid` flag and `errors` array.

### 3b. Push (CLI to Backend to R2)

- **1.** `pushSkill` calls `loadManifest(cwd)` to detect mode:
  - **Workspace:** Calls `pushWorkspace` -- iterates `manifest.skills`, packs each subdirectory, uploads each as a separate skill. Supports per-entry `files.include/exclude`.
  - **Single:** Calls `pushSingle` -- uses `manifest.name`/`manifest.namespace`, `manifest.version` auto-maps to tag. Sends `author`, `license`, `repository`, `agents`, `tags`, `dependencies` as metadata.
  - **Legacy:** Calls `pushLegacy` -- requires explicit `@ns/name` ref, validates `SKILL.md` frontmatter.
- **2.** `packDirectory` uses `fast-glob` + `tar.create({gzip:true})` to produce `.tar.gz` Buffer. Respects `files.include/exclude` from manifest.
- **3.** SHA256 checksum computed client-side.
- **4.** `RegistryClient.pushSkill` sends multipart/form-data POST to `/api/skills/:ns/:name?tag=`.
- **5.** Backend route handler verifies auth + namespace maintainer role.
- **6.** Backend recomputes SHA256 checksum server-side (Web Crypto `crypto.subtle.digest`).
- **7.** `createOrUpdateSkill` upserts `skills` row (including `author`, `license`, `repository`, `agents`, `searchTags`, `dependencies`), uploads tarball to R2 with key `<namespace>/<skillName>/<tag>.tar.gz`, upserts `skill_tags` row.
- **7b.** If tag is not `latest`, auto-upserts a `latest` tag pointing to the same artifact.
- **8.** Audit log written via `logAuditEvent`.

### 3c. Install (CLI from Backend R2 proxy)

- **1.** `installSkill` parses ref: full `@ns/name` or short name (triggers search for disambiguation).
- **2.** `RegistryClient.getSkillTag(ns, name, tag)` calls `GET /api/skills/:ns/:name/tags/:tag`.
- **3.** Backend returns a download URL pointing to the R2 download proxy route (`/api/skills/download/:key`).
- **4.** CLI downloads tarball via the download proxy (Worker streams R2 object body).
- **5.** Client-side SHA256 checksum verification.
- **6.** Extraction to `~/.skillr/cache/<namespace>/<name>/` via `tar.extract`.
- **7.** `detectAgentEnv` checks for `.claude/` or `.agents/` directory; `createSkillSymlink` links accordingly.
- **8.** `InstalledSkill` record written to `~/.skillr/installed.json`.

### 3d. Update (batch latest check)

- **1.** `updateSkills` reads `installed.json`.
- **2.** For each installed skill (or a specific ref), calls `installSkill(ref, 'latest', ...)`, which overwrites cache and re-symlinks.

### 3e. Search (CLI, API, MCP)

- **1. CLI:** `packages/cli/src/commands/search.ts` calls `RegistryClient.searchSkills(query, namespace, limit, { agent, tag })`. Supports `--agent` and `--tag` filters.
- **2. API:** `GET /api/skills?q=&namespace=&limit=&agent=&tag=` in `apps/api/src/routes/skills.ts`.
- **3. Backend:** `searchSkills` in `skill.service.ts` uses Drizzle `like` on `skills.name` and `skills.description`, ordered by `downloads` DESC. Optional `agentFilter` matches against `skills.agents` JSON; `tagFilter` matches against `skills.search_tags` JSON.
- **4. MCP (stdio):** `search_skills` tool in `packages/mcp/src/index.ts` calls the same `GET /api/skills` endpoint.
- **5. MCP (SSE):** `search_skills` via `/mcp/sse` endpoint in `apps/api/src/routes/mcp.ts`, same backend logic.

## 4. Design Rationale

- **R2 key format** `<namespace>/<skillName>/<tag>.tar.gz` mirrors the logical hierarchy.
- **R2 download proxy** replaces presigned URLs. The Worker streams R2 content directly, simplifying the architecture.
- **Dual checksum** ensures end-to-end integrity.
- **MCP dual-mode:** SSE (built-in, zero-config) for agents that support HTTP; stdio (standalone `@skillr/mcp`) for Claude Desktop and similar tools.
- **Symlink auto-detection** enables zero-config integration with Claude Code and Codex.
