# skill.json — Skill Manifest Design

## Problem

SKILL.md currently serves dual roles: metadata (YAML frontmatter) and documentation (Markdown body). This creates three problems:

1. Limited metadata — only `name` and `description` are supported; no author, license, tags, agent compatibility, or dependency declaration.
2. Single-skill publishing — each `skillr push` publishes one skill from the current directory. Projects with multiple skills require multiple pushes from different directories.
3. Mixed concerns — metadata is embedded in a human-readable document, making programmatic parsing fragile.

## Solution

Introduce `skill.json` as the primary manifest file, separating metadata from content. SKILL.md remains as the skill's readable content/instructions.

## skill.json Schema

### Multi-skill (workspace) mode

```json
{
  "name": "@frontend/skills",
  "version": "1.0.0",
  "author": "djj <djj@example.com>",
  "license": "MIT",
  "repository": "https://github.com/example/skills",
  "namespace": "@frontend",
  "skills": [
    {
      "path": "skills/code-review",
      "name": "code-review",
      "description": "Automated code review skill",
      "agents": ["claude-code", "codex"],
      "tags": ["review", "quality"],
      "dependencies": ["@default/utils"],
      "files": {
        "include": ["**/*"],
        "exclude": ["tests/**"]
      }
    },
    {
      "path": "skills/tdd",
      "name": "tdd",
      "description": "Test-driven development workflow",
      "agents": ["claude-code"],
      "tags": ["testing", "workflow"]
    }
  ]
}
```

### Single-skill mode

When `skills` array is absent, the root directory is treated as a single skill:

```json
{
  "name": "my-skill",
  "description": "A useful skill",
  "version": "1.0.0",
  "author": "djj",
  "license": "MIT",
  "agents": ["claude-code"],
  "tags": ["utility"]
}
```

### Field Definitions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Project name (workspace) or skill name (single) |
| `version` | string | no | Semver version. If present and `--tag` is not specified, used as the publish tag |
| `author` | string | no | Author name or "name \<email\>" |
| `license` | string | no | SPDX license identifier |
| `repository` | string | no | Source code URL |
| `namespace` | string | no | Default namespace for push. Must match `^@[a-z0-9][a-z0-9-]*$`. Validated on load. |
| `skills` | array | no | List of skill entries (workspace mode) |
| `description` | string | yes* | Skill description (*required in single-skill mode; in workspace mode, each skill entry has its own) |
| `agents` | string[] | no | Compatible agents: `claude-code`, `codex`, `openclaw` |
| `tags` | string[] | no | Search/discovery tags |
| `dependencies` | string[] | no | Other skills this depends on (e.g., `@default/utils`). Informational only — install prints a warning but does not auto-resolve. |
| `files.include` | string[] | no | Glob patterns to include (default: `**/*`) |
| `files.exclude` | string[] | no | Glob patterns to exclude. **Appended** to built-in ignore list (`node_modules/**`, `.git/**`, etc.), never replaces it. |

### Skill entry fields (within `skills` array)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `path` | string | yes | Subdirectory path (must contain SKILL.md) |
| `name` | string | yes | Skill name |
| `description` | string | yes | Skill description |
| `agents` | string[] | no | Overrides project-level agents |
| `tags` | string[] | no | Search tags |
| `dependencies` | string[] | no | Skill dependencies |
| `files` | object | no | File include/exclude filters |

### version and tag relationship

- `skillr push` with explicit `--tag v1.2.0` always wins.
- If `--tag` is not specified and skill.json has `version`, the version is used as the tag AND `latest` is also updated.
- If neither is specified, the tag defaults to `latest`.

## CLI Changes

### `skillr push` — new flow

The `<ref>` positional argument changes to `[ref]` (optional).

```
1. Look for skill.json in current directory
   ├── Found + has "skills" array → workspace mode
   │   ├── ref not provided → push ALL skills in the array
   │   ├── ref is a path (e.g., "skills/code-review") → push only that skill
   │   └── ref is @ns/name → push the matching skill entry by name
   ├── Found + no "skills" → single-skill mode
   │   ├── ref not provided → derive @ns/name from skill.json (namespace + name)
   │   └── ref provided → use ref as @ns/name (overrides skill.json)
   └── Not found → legacy mode
       └── ref is required; look for SKILL.md frontmatter (backward compatible)
```

**Namespace resolution** (in order):
1. Explicit `@ns/name` in ref argument
2. `namespace` field in skill.json
3. Default to `@default` (no interactive prompt — deterministic for CI/agent use)

**Workspace error handling:**
- Push each skill sequentially. On failure, log the error and continue with remaining skills.
- At the end, print a summary: "Published 3/4 skills. 1 failed: skills/broken-one"
- Set `process.exitCode = 1` if any skill failed. This ensures CI detects partial failures.
- No rollback of already-published skills (registry is append-only by design).

**`packDirectory` integration:**
- `push` command reads skill.json, resolves `files.include` and `files.exclude`.
- Passes them to `packDirectory(dir, { include, exclude })` as new optional parameters.
- `packDirectory` merges user `exclude` with built-in `IGNORE_PATTERNS` (append, never replace).
- `include` defaults to `['**/*']` if not specified.

### `skillr scan` — new flow

```
1. Found skill.json → validate each skill entry
2. Not found → scan for **/SKILL.md (existing behavior)
```

Validation:
- Each skill's `path` directory must exist and contain SKILL.md
- `name` and `description` must be non-empty
- `namespace` (if present) must match `^@[a-z0-9][a-z0-9-]*$`
- `agents` (if present) values must be known identifiers

**Output format:** Reuses `ScannedSkill[]` type. In skill.json mode, `path` is the skill entry's path (e.g., `skills/code-review/SKILL.md`), `directory` is the entry's path. JSON output remains backward compatible.

### `skillr init` — new command

Interactive generator:

```
$ skillr init
? Project name: my-skills
? Author: djj
? License: MIT
? Mode: (1) single skill  (2) workspace
  → If single: Creates skill.json + SKILL.md in current directory
  → If workspace: Creates skill.json + skills/example/SKILL.md scaffold
```

### `skillr install` — unchanged

No changes to install behavior. `files.include/exclude` affects `push` packaging only.

When dependencies are declared, `install` prints: "This skill depends on: @default/utils. Install with: skillr install @default/utils"

## Backend Changes

### Database schema additions

`skills` table changes:

```sql
-- New columns (all nullable, backward compatible)
ALTER TABLE skills ADD COLUMN author TEXT;
ALTER TABLE skills ADD COLUMN license TEXT;
ALTER TABLE skills ADD COLUMN repository TEXT;
ALTER TABLE skills ADD COLUMN agents TEXT DEFAULT '[]';       -- JSON array of strings
ALTER TABLE skills ADD COLUMN search_tags TEXT DEFAULT '[]';  -- JSON array of strings

-- Migrate existing dependencies column from object to array type
-- Old: '{}' (empty object), New: '[]' (empty array)
-- Safe because no production skills have used the dependencies field yet
```

Drizzle schema update for `dependencies`:
```typescript
// Before: text('dependencies', { mode: 'json' }).$type<Record<string, unknown>>().default({})
// After:  text('dependencies', { mode: 'json' }).$type<string[]>().default([])
```

Note: existing `skill_tags` table is for **version tags** (latest, v1.0.0). `search_tags` is a separate concept for discovery.

### Push API

The push endpoint (`POST /api/skills/:ns/:name`) metadata parameter is extended to accept the new fields (`author`, `license`, `repository`, `agents`, `tags`). CLI sends them from skill.json. No API signature change needed — metadata is already a JSON object. The `createOrUpdateSkill` service function is updated to extract and store these fields.

### Search API

`searchSkills` function extended with optional filters:
- `--agent claude-code` → `WHERE agents LIKE '%"claude-code"%'` (JSON substring match, sufficient for small string arrays)
- `--tag review` → `WHERE search_tags LIKE '%"review"%'` (same approach)
- Full-text search still uses `LIKE` on `name` and `description` as before

For the scale of this registry (hundreds to low thousands of skills), JSON substring matching is adequate. If scale grows, migrate to SQLite FTS5 or normalized join tables.

### Web frontend

- Skill detail page: display author, license, agents (as badges), search tags
- Publish page: optional fields for author, license, agents, tags

## Directory Structure Examples

### Workspace project

```
my-skills/
  skill.json              ← manifest with skills array
  skills/
    code-review/
      SKILL.md             ← skill content
      helpers/
        review-checklist.md
    tdd/
      SKILL.md
```

### Single-skill project

```
my-skill/
  skill.json              ← manifest (no skills array)
  SKILL.md                ← skill content
```

### Legacy project (backward compatible)

```
my-skill/
  SKILL.md                ← frontmatter provides name + description
```

## Migration

- No breaking changes. Existing SKILL.md-only projects continue to work.
- `skillr init` can generate skill.json from existing SKILL.md frontmatter.
- New fields are nullable in the database; existing skills are unaffected.
- `dependencies` column type changes from `{}` to `[]` — safe since no production data uses it.
