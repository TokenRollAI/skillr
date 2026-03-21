# Architecture of Skill Lifecycle

## 1. Identity

- **What it is:** The end-to-end data flow of a Skill artifact through: scan, push, install, update, and search.
- **Purpose:** Serves as the LLM retrieval map for tracing how a Skill moves from local directory to registry to consumer project.

## 2. Core Components

- `packages/cli/src/commands/scan.ts` (`scanDirectory`, `ScannedSkill`): Local directory traversal, SKILL.md frontmatter parsing, lint validation.
- `packages/cli/src/commands/push.ts` (`pushSkill`, `packDirectory`): Tarball packing, SHA256 checksum, multipart upload via RegistryClient.
- `packages/cli/src/commands/install.ts` (`installSkill`, `updateSkills`, `InstalledSkill`): Tag resolution, signed URL download, checksum verify, extraction, symlink, installed.json registry.
- `packages/cli/src/commands/search.ts` (`searchSkills`): CLI search entry point, delegates to RegistryClient.
- `packages/cli/src/lib/registry-client.ts` (`RegistryClient`): HTTP client wrapping all Backend API calls.
- `packages/cli/src/lib/symlink.ts` (`detectAgentEnv`, `getSymlinkTarget`, `createSkillSymlink`): Agent environment detection and symlink creation.
- `packages/backend/src/routes/skills.ts` (`skillsRoutes`): Hono REST routes: POST push (multipart + JSON body), GET info/tags/tag/search, DELETE.
- `packages/backend/src/services/skill.service.ts` (`createOrUpdateSkill`, `getSkillTag`, `searchSkills`): Core business logic for push, download URL generation, and search.
- `packages/backend/src/services/storage.service.ts` (`uploadArtifact`, `getSignedDownloadUrl`): Storage wrapper delegating to Runtime Adapter.
- `packages/mcp/src/index.ts` (standalone MCP Server, stdio): Read-only MCP gateway exposing `search_skills`, `get_skill_info`, `list_namespaces`, `get_install_instructions`.
- `packages/backend/src/routes/mcp.ts` (built-in MCP, SSE): Same 4 tools, exposed via `/mcp/sse` endpoint.

## 3. Execution Flow (LLM Retrieval Map)

### 3a. Scan (local-only, no network)

- **1.** CLI invokes `scanDirectory(dir)` in `packages/cli/src/commands/scan.ts`.
- **2.** `fast-glob` traverses for `**/SKILL.md`, ignoring `node_modules`, `.git`, `dist`, `build`, `.next`, `coverage`, `.turbo`.
- **3.** Each file is parsed with `gray-matter`; required fields `name` and `description` are validated.
- **4.** Returns `ScannedSkill[]` with `valid` flag and `errors` array.

### 3b. Push (CLI to Backend to S3/R2)

- **1.** `pushSkill` validates SKILL.md frontmatter (`name`, `description` required).
- **2.** `packDirectory` uses `fast-glob` + `tar.create({gzip:true})` to produce `.tar.gz` Buffer.
- **3.** SHA256 checksum computed client-side.
- **4.** `RegistryClient.pushSkill` sends multipart/form-data POST to `/api/skills/:ns/:name?tag=`.
- **5.** Backend route handler verifies auth + namespace maintainer role.
- **6.** Backend recomputes SHA256 checksum server-side.
- **7.** `createOrUpdateSkill` upserts `skills` row, uploads tarball to S3/R2 with key `<namespace>/<skillName>/<tag>.tar.gz`, upserts `skill_tags` row.
- **8.** Audit log written via `logAuditEvent`.

### 3b-2. Web Publishing (Browser)

- **1.** User navigates to `/skills/publish` in the Skillr web UI.
- **2.** Fills in metadata (name, namespace, description, readme) and submits.
- **3.** Frontend sends `POST /api/skills/:ns/:name` with **JSON body** (not multipart).
- **4.** Backend handles JSON body path: creates skill record with metadata only (no tarball artifact).

### 3c. Install (CLI from Backend + S3/R2)

- **1.** `installSkill` parses ref: full `@ns/name` or short name (triggers search for disambiguation).
- **2.** `RegistryClient.getSkillTag(ns, name, tag)` calls `GET /api/skills/:ns/:name/tags/:tag`.
- **3.** Backend generates a presigned S3/R2 URL (1 hour TTL) and increments `downloads` counter.
- **4.** CLI downloads tarball directly from presigned URL (no Backend proxy).
- **5.** Client-side SHA256 checksum verification.
- **6.** Extraction to `~/.skillr/cache/<namespace>/<name>/` via `tar.extract`.
- **7.** `detectAgentEnv` checks for `.claude/` or `.agents/` directory; `createSkillSymlink` links accordingly.
- **8.** `InstalledSkill` record written to `~/.skillr/installed.json`.

### 3d. Update (batch latest check)

- **1.** `updateSkills` reads `installed.json`.
- **2.** For each installed skill (or a specific ref), calls `installSkill(ref, 'latest', ...)`, which overwrites cache and re-symlinks.

### 3e. Search (CLI, API, MCP)

- **1. CLI:** `packages/cli/src/commands/search.ts` calls `RegistryClient.searchSkills(query, namespace, limit)`.
- **2. API:** `GET /api/skills?q=&namespace=&limit=` in `packages/backend/src/routes/skills.ts`.
- **3. Backend:** `searchSkills` in `skill.service.ts` uses Drizzle `ilike` on `skills.name` and `skills.description`, ordered by `downloads` DESC.
- **4. MCP (stdio):** `search_skills` tool in `packages/mcp/src/index.ts` calls the same `GET /api/skills` endpoint.
- **5. MCP (SSE):** `search_skills` via `/mcp/sse` endpoint in `packages/backend/src/routes/mcp.ts`, same backend logic.

## 4. Design Rationale

- **S3 key format** `<namespace>/<skillName>/<tag>.tar.gz` mirrors the logical hierarchy.
- **Presigned URL download** offloads bandwidth from Backend to S3/R2.
- **Dual checksum** ensures end-to-end integrity.
- **MCP dual-mode:** SSE (built-in, zero-config) for agents that support HTTP; stdio (standalone `@skillr/mcp`) for Claude Desktop and similar tools requiring process-based MCP.
- **Symlink auto-detection** enables zero-config integration with Claude Code and Codex.
