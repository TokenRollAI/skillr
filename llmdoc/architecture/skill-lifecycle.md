# Architecture of Skill Lifecycle

## 1. Identity

- **What it is:** The end-to-end data flow of a Skill artifact through: scan, push, install, update, and search.
- **Purpose:** Serves as the LLM retrieval map for tracing how a Skill moves from local directory to registry to consumer project.

## 2. Core Components

- `packages/cli/src/commands/scan.ts` (`scanDirectory`, `ScannedSkill`): Local directory traversal, SKILL.md frontmatter parsing, lint validation.
- `packages/cli/src/commands/push.ts` (`pushSkill`, `packDirectory`): Tarball packing, SHA256 checksum, multipart upload via RegistryClient.
- `packages/cli/src/commands/install.ts` (`installSkill`, `updateSkills`, `InstalledSkill`): Tag resolution, signed URL download, checksum verify, extraction, symlink, installed.json registry.
- `packages/cli/src/commands/search.ts` (`searchSkills`): CLI search entry point, delegates to RegistryClient.
- `packages/cli/src/lib/registry-client.ts` (`RegistryClient`): HTTP client wrapping all Backend API calls (pushSkill, getSkillTag, searchSkills).
- `packages/cli/src/lib/symlink.ts` (`detectAgentEnv`, `getSymlinkTarget`, `createSkillSymlink`): Agent environment detection and symlink creation.
- `packages/backend/src/routes/skills.ts` (`skillsRoutes`): Hono REST routes: POST push, GET info/tags/tag/search, DELETE.
- `packages/backend/src/services/skill.service.ts` (`createOrUpdateSkill`, `getSkillTag`, `searchSkills`): Core business logic for push, download URL generation, and search.
- `packages/backend/src/services/storage.service.ts` (`uploadArtifact`, `getSignedDownloadUrl`): S3 artifact storage and presigned URL generation.
- `packages/mcp/src/index.ts` (MCP Server): Read-only MCP gateway exposing `search_skills`, `get_skill_info`, `list_namespaces`, `get_install_instructions`.

## 3. Execution Flow (LLM Retrieval Map)

### 3a. Scan (local-only, no network)

- **1.** CLI invokes `scanDirectory(dir)` in `packages/cli/src/commands/scan.ts:30-58`.
- **2.** `fast-glob` traverses for `**/SKILL.md`, ignoring `node_modules`, `.git`, `dist`, `build`, `.next`, `coverage`, `.turbo`.
- **3.** Each file is parsed with `gray-matter`; required fields `name` and `description` are validated.
- **4.** Returns `ScannedSkill[]` with `valid` flag and `errors` array.

### 3b. Push (CLI to Backend to S3)

- **1.** `pushSkill` in `packages/cli/src/commands/push.ts:39-124` validates SKILL.md frontmatter (`name`, `description` required).
- **2.** `packDirectory` (line 23-37) uses `fast-glob` + `tar.create({gzip:true})` to produce an in-memory `.tar.gz` Buffer.
- **3.** SHA256 checksum computed client-side via `crypto.createHash('sha256')`.
- **4.** `RegistryClient.pushSkill` (line 50-79 in `registry-client.ts`) sends multipart/form-data POST to `/api/skills/:ns/:name?tag=`.
- **5.** Backend route handler `packages/backend/src/routes/skills.ts:14-84` verifies auth + namespace maintainer role.
- **6.** Backend recomputes SHA256 checksum server-side (line 57).
- **7.** `createOrUpdateSkill` in `packages/backend/src/services/skill.service.ts:7-76` upserts `skills` row, uploads tarball to S3 with key `<namespace>/<skillName>/<tag>.tar.gz`, upserts `skill_tags` row storing `artifactKey`, `sizeBytes`, `checksum`.
- **8.** Audit log written via `logAuditEvent`.

### 3c. Install (CLI from Backend + S3)

- **1.** `installSkill` in `packages/cli/src/commands/install.ts:44-207` parses ref: full `@ns/name` or short name (triggers search for disambiguation).
- **2.** `RegistryClient.getSkillTag(ns, name, tag)` calls `GET /api/skills/:ns/:name/tags/:tag`.
- **3.** Backend handler (line 121-141 in `skills.ts`) calls `skill.service.getSkillTag` which generates a presigned S3 URL (1 hour TTL) via `storage.service.getSignedDownloadUrl` and increments `downloads` counter.
- **4.** CLI downloads tarball directly from S3 presigned URL (no Backend proxy).
- **5.** Client-side SHA256 checksum verification against `tagInfo.checksum`.
- **6.** Extraction to `~/.skillhub/cache/<namespace>/<name>/` via `tar.extract`.
- **7.** `detectAgentEnv` checks for `.claude/` or `.agents/` directory; `createSkillSymlink` links cache to `.claude/skills/<ns>/<name>` or `.agents/skills/<ns>/<name>`.
- **8.** `InstalledSkill` record written to `~/.skillhub/installed.json`.

### 3d. Update (batch latest check)

- **1.** `updateSkills` in `packages/cli/src/commands/install.ts:209-235` reads `installed.json`.
- **2.** For each installed skill (or a specific ref), calls `installSkill(ref, 'latest', ...)`, which overwrites cache and re-symlinks.

### 3e. Search (CLI, API, MCP)

- **1. CLI:** `packages/cli/src/commands/search.ts:6-44` calls `RegistryClient.searchSkills(query, namespace, limit)`.
- **2. API:** `GET /api/skills?q=&namespace=&limit=` in `packages/backend/src/routes/skills.ts:144-159`.
- **3. Backend:** `searchSkills` in `skill.service.ts:110-141` uses Drizzle `ilike` on `skills.name` and `skills.description`, ordered by `downloads` DESC.
- **4. MCP:** `search_skills` tool in `packages/mcp/src/index.ts:27-62` calls the same `GET /api/skills` endpoint.

## 4. Design Rationale

- **S3 key format** `<namespace>/<skillName>/<tag>.tar.gz` mirrors the logical hierarchy and enables simple browsing/cleanup.
- **Presigned URL download** offloads bandwidth from Backend to S3; CLI never streams through the API server.
- **Dual checksum** (client-compute on push, server-recompute on push, client-verify on install) ensures end-to-end integrity.
- **Multi-registry federation** is a pure CLI-side concept: `SkillhubConfig.sources[]` stores multiple registry URLs, each with independent auth. Backend instances are unaware of each other. This is analogous to Homebrew taps or npm scoped registries.
- **Symlink auto-detection** enables zero-config integration: installing a skill in a Claude Code project automatically places it where Claude Code expects skills (`.claude/skills/`), and similarly for Codex (`.agents/skills/`).
