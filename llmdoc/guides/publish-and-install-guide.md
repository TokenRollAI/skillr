# How to Publish and Install Skills

A step-by-step guide for creating, publishing, installing, updating, and discovering skills on the Skillr registry.

## 1. Create a SKILL.md

Create a `SKILL.md` file in the skill's root directory with YAML frontmatter. Required fields: `name`, `description`. Optional: `version`.

Reference: `packages/cli/src/commands/scan.ts` (`REQUIRED_FIELDS`).

```yaml
---
name: my-deploy-helper
description: Automates frontend deployment to S3 and CloudFront
version: 1.0.0
---
# My Deploy Helper
Detailed instructions for the AI agent...
```

Validate locally with `skillr scan` (runs `scanDirectory` -- no network required).

## 2. Publish a Skill (CLI)

1. Authenticate: `skillr login <server-url>` (OAuth Device Code flow).
2. Navigate to the directory containing `SKILL.md`.
3. Run: `skillr push @my-namespace/my-deploy-helper` (or short: `skillr push my-deploy-helper` to use `@default` namespace).
4. Optionally specify a tag: `skillr push @my-namespace/my-deploy-helper -t v1.0.0` (defaults to `latest`).

The CLI packs the directory into a `.tar.gz`, computes SHA256, and uploads via multipart POST to the registry. See `/llmdoc/architecture/skill-lifecycle.md` section 3b.

## 2b. Web Publishing (Browser)

For non-technical users or quick publishing without CLI:

1. Open the Skillr web UI and navigate to `/skills/publish`.
2. Fill in skill metadata (name, namespace, description) and upload the skill files.
3. Submit to publish directly from the browser.

The web UI sends a JSON body to `POST /api/skills/:ns/:name` (not multipart).

## 3. Install a Skill

```bash
skillr install @my-namespace/my-deploy-helper
```

**Short name** (triggers search for disambiguation):
```bash
skillr install my-deploy-helper
```

**Specific tag:**
```bash
skillr install @my-namespace/my-deploy-helper -t v1.0.0
```

The CLI downloads from the R2 download proxy (`/api/skills/download/:key`), verifies checksum, extracts to `~/.skillr/cache/<ns>/<name>/`, and records in `~/.skillr/installed.json`.

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
skillr update
```

**Update specific skill:**
```bash
skillr update @my-namespace/my-deploy-helper
```

Reads `~/.skillr/installed.json`, re-installs each skill with `latest` tag, overwrites cache, and refreshes symlinks.

## 6. Use MCP Gateway for Dynamic Discovery

Skillr provides two MCP modes for AI agents:

**Mode 1: Built-in SSE (zero-config, recommended)**

The backend includes MCP endpoints at `/mcp/sse`. Configure your AI agent:
```json
{
  "mcpServers": {
    "skillr": {
      "type": "sse",
      "url": "https://api.skillhub.tokenroll.ai/mcp/sse"
    }
  }
}
```

**Mode 2: Standalone stdio (`@skillr/mcp`)**

For Claude Desktop or tools requiring a process-based MCP server:
```json
{
  "mcpServers": {
    "skillr": {
      "command": "npx",
      "args": ["@skillr/mcp"],
      "env": {
        "SKILLHUB_BACKEND_URL": "https://api.skillhub.tokenroll.ai",
        "SKILLHUB_TOKEN": "sk_live_xxx"
      }
    }
  }
}
```

Both modes expose 4 read-only tools: `search_skills`, `get_skill_info`, `list_namespaces`, `get_install_instructions`.
