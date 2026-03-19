# How to Use the Skillhub CLI

All commands support `--json` flag for machine-readable output. Non-TTY environments auto-select JSON mode.

## 1. Source Management

Manage registry sources (local config only, no network calls).

1. **List sources:** `skillhub source list`
2. **Add a source:** `skillhub source add my-registry https://registry.example.com`
   - URL must be http/https. Duplicate names or URLs are rejected.
3. **Remove a source:** `skillhub source remove my-registry`
   - Cannot remove the last source. If removed source was default, `sources[0]` becomes default.
4. **Set default:** `skillhub source set-default my-registry`

Reference: `packages/cli/src/commands/source.ts` (`registerSourceCommands`)

## 2. Authentication Workflow

Uses OAuth 2.0 Device Code flow. Tokens stored per source URL in `~/.skillhub/config.json`.

1. **Login:** `skillhub auth login` (or `skillhub auth login -s my-registry`)
   - Displays a verification URL and user code. Open URL in browser, enter code.
2. **Check identity:** `skillhub auth whoami` (or `-s <source>`)
3. **View all auth status:** `skillhub auth status`
   - Shows "Authenticated (env token)" if `SKILLHUB_TOKEN` env var is set.
4. **Logout:** `skillhub auth logout` (or `-s <source>`)

Token priority: `SKILLHUB_TOKEN` env var > stored `config.auth[sourceUrl].token`.

Reference: `packages/cli/src/commands/auth.ts` (`loginFlow`, `whoami`, `authStatus`)

## 3. Skill Scanning

Discover and validate `SKILL.md` files in a directory tree.

1. **Scan current dir:** `skillhub scan`
2. **Scan specific dir:** `skillhub scan ./my-skills`
3. Validates YAML frontmatter for required fields: `name`, `description`.
4. **JSON mode:** `skillhub scan --json` outputs raw `ScannedSkill[]` array (bypasses `formatScanReport`).

Reference: `packages/cli/src/commands/scan.ts` (`scanDirectory`, `ScannedSkill`)

## 4. Publishing a Skill

Push a skill from CWD to the registry. Requires `SKILL.md` with valid frontmatter.

1. **Full ref:** `skillhub push @myns/my-skill -t v1.0`
2. **Short name (auto-prepends `@default/`):** `skillhub push my-skill`
3. Packs CWD as gzipped tarball (excludes `node_modules`, `.git`, `dist`, etc.), computes sha256, uploads via multipart/form-data.

Reference: `packages/cli/src/commands/push.ts` (`pushSkill`)

## 5. Installing a Skill

Download, verify, cache, and symlink a skill.

1. **Full ref:** `skillhub install @myns/my-skill -t v1.0`
2. **Short name (smart resolution):** `skillhub install my-skill`
   - Searches registry, requires exactly one exact name match. Warns on ambiguity.
3. Extracts to `~/.skillhub/cache/<namespace>/<skill>`.
4. Auto-symlinks into `.claude/skills/` or `.agents/skills/` if agent environment detected in CWD.
5. Records in `~/.skillhub/installed.json`.

Reference: `packages/cli/src/commands/install.ts` (`installSkill`)

## 6. Updating Installed Skills

Re-install all (or one) installed skills at `latest` tag.

1. **Update all:** `skillhub update`
2. **Update one:** `skillhub update @myns/my-skill`

Reference: `packages/cli/src/commands/install.ts` (`updateSkills`)

## 7. Searching the Registry

1. **Basic search:** `skillhub search "code review"`
2. **Filter by namespace:** `skillhub search "lint" -n @myns`
3. **Limit results:** `skillhub search "test" -l 5`
4. Results table includes an `Install Command` column for convenience.

Reference: `packages/cli/src/commands/search.ts` (`searchSkills`)

## 8. JSON Output Mode for Agents

For programmatic consumption by AI agents or scripts:

1. **Explicit:** Add `--json` to any command: `skillhub search "test" --json`
2. **Implicit:** Pipe output (non-TTY auto-detection): `skillhub search "test" | jq .`
3. All messages become `{ "type": "info|success|error|warn", "message": "..." }` on stdout.
4. Tables become `{ "type": "table", "data": [{ header: value }] }`.
5. **Note:** `error` type also goes to stdout in JSON mode (not stderr).

Reference: `packages/cli/src/lib/output.ts` (`JsonOutput`, `createOutput`)
