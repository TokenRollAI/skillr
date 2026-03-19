# How to Use the Skillhub CLI

All commands support `--json` flag for machine-readable output. Non-TTY environments auto-select JSON mode.

## 1. First-Time Setup & Login

No default source is configured. You must provide a server URL on first login.

1. **First login:** `skillr login http://localhost:3001`
   - This is a top-level shortcut for `skillr auth login`. It registers the server as a source and initiates the Device Code authentication flow.
2. **Multi-server workflow:**
   ```
   skillr login http://localhost:3001          # Dev server
   skillr login https://skills.company.com     # Production server
   skillr source list                          # See all configured servers
   skillr source set-default production
   ```

Reference: `packages/cli/src/commands/auth.ts` (`loginFlow`)

## 2. Source Management

Manage registry sources (local config only, no network calls).

1. **List sources:** `skillr source list`
2. **Add a source:** `skillr source add my-registry https://registry.example.com`
   - URL must be http/https. Duplicate names or URLs are rejected.
3. **Remove a source:** `skillr source remove my-registry`
   - Cannot remove the last source. If removed source was default, `sources[0]` becomes default.
4. **Set default:** `skillr source set-default my-registry`

Reference: `packages/cli/src/commands/source.ts` (`registerSourceCommands`)

## 3. Authentication Workflow

Uses OAuth 2.0 Device Code flow. Tokens stored per source URL in `~/.skillhub/config.json`.

1. **Login (top-level shortcut):** `skillr login <url>` -- adds source and authenticates in one step.
2. **Login (via auth subcommand):** `skillr auth login` (or `skillr auth login -s my-registry`)
   - Displays a verification URL and user code. Open URL in browser, enter code.
3. **Check identity:** `skillr auth whoami` (or `-s <source>`)
4. **View all auth status:** `skillr auth status`
   - Shows "Authenticated (env token)" if `SKILLHUB_TOKEN` env var is set.
5. **Logout:** `skillr auth logout` (or `-s <source>`)

Token priority: `SKILLHUB_TOKEN` env var > stored `config.auth[sourceUrl].token`.

Reference: `packages/cli/src/commands/auth.ts` (`loginFlow`, `whoami`, `authStatus`)

## 4. Skill Scanning

Discover and validate `SKILL.md` files in a directory tree.

1. **Scan current dir:** `skillhub scan`
2. **Scan specific dir:** `skillhub scan ./my-skills`
3. Validates YAML frontmatter for required fields: `name`, `description`.
4. **JSON mode:** `skillhub scan --json` outputs raw `ScannedSkill[]` array (bypasses `formatScanReport`).

Reference: `packages/cli/src/commands/scan.ts` (`scanDirectory`, `ScannedSkill`)

## 5. Publishing a Skill

Push a skill from CWD to the registry. Requires `SKILL.md` with valid frontmatter.

1. **Full ref:** `skillhub push @myns/my-skill -t v1.0`
2. **Short name (auto-prepends `@default/`):** `skillhub push my-skill`
3. Packs CWD as gzipped tarball (excludes `node_modules`, `.git`, `dist`, etc.), computes sha256, uploads via multipart/form-data.

Reference: `packages/cli/src/commands/push.ts` (`pushSkill`)

## 6. Installing a Skill

Download, verify, cache, and symlink a skill.

1. **Full ref:** `skillhub install @myns/my-skill -t v1.0`
2. **Short name (smart resolution):** `skillhub install my-skill`
   - Searches registry, requires exactly one exact name match. Warns on ambiguity.
3. Extracts to `~/.skillhub/cache/<namespace>/<skill>`.
4. Auto-symlinks into `.claude/skills/` or `.agents/skills/` if agent environment detected in CWD.
5. Records in `~/.skillhub/installed.json`.

Reference: `packages/cli/src/commands/install.ts` (`installSkill`)

## 7. Updating Installed Skills

Re-install all (or one) installed skills at `latest` tag.

1. **Update all:** `skillhub update`
2. **Update one:** `skillhub update @myns/my-skill`

Reference: `packages/cli/src/commands/install.ts` (`updateSkills`)

## 8. Searching the Registry

1. **Basic search:** `skillhub search "code review"`
2. **Filter by namespace:** `skillhub search "lint" -n @myns`
3. **Limit results:** `skillhub search "test" -l 5`
4. Results table includes an `Install Command` column for convenience.

Reference: `packages/cli/src/commands/search.ts` (`searchSkills`)

## 9. JSON Output Mode for Agents

For programmatic consumption by AI agents or scripts:

1. **Explicit:** Add `--json` to any command: `skillhub search "test" --json`
2. **Implicit:** Pipe output (non-TTY auto-detection): `skillhub search "test" | jq .`
3. All messages become `{ "type": "info|success|error|warn", "message": "..." }` on stdout.
4. Tables become `{ "type": "table", "data": [{ header: value }] }`.
5. **Note:** `error` type also goes to stdout in JSON mode (not stderr).

Reference: `packages/cli/src/lib/output.ts` (`JsonOutput`, `createOutput`)
