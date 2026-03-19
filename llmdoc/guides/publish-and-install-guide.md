# How to Publish and Install Skills

A step-by-step guide for creating, publishing, installing, updating, and discovering skills on the Skillhub registry.

## 1. Create a SKILL.md

Create a `SKILL.md` file in the skill's root directory with YAML frontmatter. Required fields: `name`, `description`. Optional: `version`.

Reference: `packages/cli/src/commands/scan.ts:28` (`REQUIRED_FIELDS`).

```yaml
---
name: my-deploy-helper
description: Automates frontend deployment to S3 and CloudFront
version: 1.0.0
---
# My Deploy Helper
Detailed instructions for the AI agent...
```

Validate locally with `skillhub scan` (runs `scanDirectory` -- no network required).

## 2. Publish a Skill (CLI)

1. Authenticate: `skillr login <server-url>` (OAuth Device Code flow).
2. Navigate to the directory containing `SKILL.md`.
3. Run: `skillr push @my-namespace/my-deploy-helper` (or short: `skillr push my-deploy-helper` to use `@default` namespace).
4. Optionally specify a tag: `skillr push @my-namespace/my-deploy-helper -t v1.0.0` (defaults to `latest`).

The CLI packs the directory into a `.tar.gz`, computes SHA256, and uploads via multipart POST to the registry. See `/llmdoc/architecture/skill-lifecycle.md` section 3b.

## 2b. Web Publishing (Browser)

For non-technical users or quick publishing without CLI:

1. Open the Skillhub web UI and navigate to `/skills/publish`.
2. Fill in skill metadata (name, namespace, description) and upload the skill files.
3. Submit to publish directly from the browser.

## 3. Install a Skill

**Full reference:**
```bash
skillhub install @my-namespace/my-deploy-helper
```

**Short name** (triggers search for disambiguation):
```bash
skillhub install my-deploy-helper
```

**Specific tag:**
```bash
skillhub install @my-namespace/my-deploy-helper -t v1.0.0
```

The CLI downloads from a presigned S3 URL, verifies checksum, extracts to `~/.skillhub/cache/<ns>/<name>/`, and records in `~/.skillhub/installed.json`.

## 4. Symlink Auto-Detection

On install, the CLI auto-detects the agent environment in the current working directory:

| Directory detected | Symlink target                         | Agent    |
| ------------------ | -------------------------------------- | -------- |
| `.claude/`         | `.claude/skills/<ns>/<name>`           | Claude Code |
| `.agents/`         | `.agents/skills/<ns>/<name>`           | Codex    |
| Neither            | No symlink created (cache-only)        | --       |

Reference: `packages/cli/src/lib/symlink.ts` (`detectAgentEnv`, `getSymlinkTarget`).

## 5. Update Installed Skills

**Update all:**
```bash
skillhub update
```

**Update specific skill:**
```bash
skillhub update @my-namespace/my-deploy-helper
```

Reads `~/.skillhub/installed.json`, re-installs each skill with `latest` tag, overwrites cache, and refreshes symlinks. Reference: `packages/cli/src/commands/install.ts:209-235` (`updateSkills`).

## 6. Use MCP Gateway for Dynamic Discovery

For AI agents that support MCP, configure the `mcp-skillhub` server to enable runtime skill discovery without CLI. The MCP server exposes four read-only tools:

- `search_skills` -- search the registry by query and namespace.
- `get_skill_info` -- get detailed skill metadata and README.
- `list_namespaces` -- enumerate available namespaces.
- `get_install_instructions` -- get formatted install commands.

Configure via environment variables: `SKILLHUB_BACKEND_URL` and `SKILLHUB_TOKEN`. Transport: stdio. Reference: `packages/mcp/src/index.ts`.
