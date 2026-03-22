# skill.json Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce `skill.json` manifest file for skill metadata, multi-skill workspace publishing, and enhanced discovery (agents, tags, author, license, dependencies).

**Architecture:** CLI reads `skill.json` to resolve metadata and skill entries, packs each skill subdirectory, and sends extended metadata to the existing push API. Backend stores new fields in the `skills` table. No new API endpoints needed — existing push/search endpoints are extended.

**Tech Stack:** TypeScript, Commander.js (CLI), Hono (API), Drizzle ORM (D1/SQLite), Vitest (tests)

**Spec:** `docs/superpowers/specs/2026-03-22-skill-json-design.md`

---

### Task 1: Add SkillManifest type to @skillr/shared

**Files:**
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Write the SkillManifest types**

Add to `packages/shared/src/types.ts`:

```typescript
// --- skill.json manifest types ---

export interface SkillManifestEntry {
  path: string;
  name: string;
  description: string;
  agents?: string[];
  tags?: string[];
  dependencies?: string[];
  files?: {
    include?: string[];
    exclude?: string[];
  };
}

export interface SkillManifest {
  name: string;
  version?: string;
  author?: string;
  license?: string;
  repository?: string;
  namespace?: string;
  description?: string;
  agents?: string[];
  tags?: string[];
  dependencies?: string[];
  files?: {
    include?: string[];
    exclude?: string[];
  };
  skills?: SkillManifestEntry[];
}
```

Also update the `Skill` interface to include new fields:

```typescript
export interface Skill {
  id: string;
  namespaceId: string;
  name: string;
  description: string | null;
  latestTag: string | null;
  readme: string | null;
  downloads: number;
  author: string | null;
  license: string | null;
  repository: string | null;
  agents: string[];
  searchTags: string[];
  dependencies: string[];
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Build shared**

Run: `pnpm --filter @skillr/shared build`
Expected: clean build

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat(shared): add SkillManifest types and extend Skill interface"
```

---

### Task 2: Backend — extend skills DB schema and service

**Files:**
- Modify: `apps/api/src/models/skill.ts` — add new columns
- Modify: `apps/api/src/services/skill.service.ts` — accept and store new fields, extend search
- Modify: `apps/api/d1-migration.sql` — add ALTER TABLE statements

- [ ] **Step 1: Update Drizzle schema**

In `apps/api/src/models/skill.ts`, update the `skills` table:

```typescript
export const skills = sqliteTable('skills', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  namespaceId: text('namespace_id').notNull().references(() => namespaces.id),
  name: text('name').notNull(),
  description: text('description'),
  latestTag: text('latest_tag').default('latest'),
  readme: text('readme'),
  dependencies: text('dependencies', { mode: 'json' }).$type<string[]>().default([]),
  downloads: integer('downloads').default(0).notNull(),
  author: text('author'),
  license: text('license'),
  repository: text('repository'),
  agents: text('agents', { mode: 'json' }).$type<string[]>().default([]),
  searchTags: text('search_tags', { mode: 'json' }).$type<string[]>().default([]),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()).notNull(),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()).notNull(),
}, (table) => [
  uniqueIndex('skills_ns_name_unique').on(table.namespaceId, table.name),
  index('idx_skills_namespace').on(table.namespaceId),
]);
```

- [ ] **Step 2: Update createOrUpdateSkill service**

In `apps/api/src/services/skill.service.ts`, extend `createOrUpdateSkill` to accept and store `author`, `license`, `repository`, `agents`, `searchTags`, `dependencies`:

```typescript
export async function createOrUpdateSkill(
  namespaceName: string,
  skillName: string,
  tag: string,
  tarball: Uint8Array,
  checksum: string,
  metadata: Record<string, unknown>,
  publishedBy: string,
  description?: string,
  readme?: string,
) {
  // ... existing namespace/skill lookup ...

  // Extract new fields from metadata
  const author = metadata.author as string | undefined;
  const license = metadata.license as string | undefined;
  const repository = metadata.repository as string | undefined;
  const agents = (metadata.agents as string[] | undefined) ?? [];
  const searchTags = (metadata.tags as string[] | undefined) ?? [];
  const deps = (metadata.dependencies as string[] | undefined) ?? [];

  if (!skill) {
    [skill] = await db.insert(skills).values({
      namespaceId: ns.id,
      name: skillName,
      description: description || metadata.description as string || '',
      readme,
      latestTag: tag,
      author: author ?? null,
      license: license ?? null,
      repository: repository ?? null,
      agents,
      searchTags,
      dependencies: deps,
      createdAt: now,
      updatedAt: now,
    }).returning();
  } else {
    await db.update(skills).set({
      description: description || metadata.description as string || skill.description,
      readme: readme || skill.readme,
      latestTag: tag,
      author: author ?? skill.author,
      license: license ?? skill.license,
      repository: repository ?? skill.repository,
      agents: agents.length > 0 ? agents : skill.agents,
      searchTags: searchTags.length > 0 ? searchTags : skill.searchTags,
      dependencies: deps.length > 0 ? deps : skill.dependencies,
      updatedAt: now,
    }).where(eq(skills.id, skill!.id));
  }
  // ... rest unchanged ...
}
```

- [ ] **Step 3: Extend searchSkills with agent/tag filters**

In `searchSkills`, add optional `agent` and `tag` filter params:

```typescript
export async function searchSkills(
  query: string,
  namespace?: string,
  page = 1,
  limit = 20,
  userId?: string,
  agentFilter?: string,
  tagFilter?: string,
) {
  // ... existing conditions ...

  if (agentFilter) {
    conditions.push(like(skills.agents, `%"${agentFilter}"%`));
  }
  if (tagFilter) {
    conditions.push(like(skills.searchTags, `%"${tagFilter}"%`));
  }

  // ... rest unchanged ...
}
```

- [ ] **Step 4: Add D1 migration SQL**

Append to `apps/api/d1-migration.sql`:

```sql
-- v2: skill.json metadata fields
ALTER TABLE skills ADD COLUMN author TEXT;
ALTER TABLE skills ADD COLUMN license TEXT;
ALTER TABLE skills ADD COLUMN repository TEXT;
ALTER TABLE skills ADD COLUMN agents TEXT DEFAULT '[]';
ALTER TABLE skills ADD COLUMN search_tags TEXT DEFAULT '[]';
```

Also create a standalone migration file `apps/api/migrations/0001-skill-metadata.sql` with the same content for `wrangler d1 migrations apply`.

- [ ] **Step 5: Run D1 migration on remote**

```bash
cd apps/api && wrangler d1 execute skillr-db --remote --file=migrations/0001-skill-metadata.sql
```

- [ ] **Step 6: Typecheck and deploy**

```bash
cd apps/api && npx tsc --noEmit && npx wrangler deploy --domain api.skillhub.tokenroll.ai
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/models/skill.ts apps/api/src/services/skill.service.ts apps/api/d1-migration.sql apps/api/migrations/
git commit -m "feat(api): extend skills schema with author, license, agents, tags, dependencies"
```

---

### Task 3: CLI — manifest loader (`packages/cli/src/lib/manifest.ts`)

**Files:**
- Create: `packages/cli/src/lib/manifest.ts`
- Create: `packages/cli/tests/unit/manifest.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/cli/tests/unit/manifest.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { loadManifest } from '../../src/lib/manifest.js';

describe('loadManifest', () => {
  let dir: string;
  beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'manifest-')); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  it('returns null when no skill.json exists', async () => {
    const result = await loadManifest(dir);
    expect(result).toBeNull();
  });

  it('loads single-skill manifest', async () => {
    await writeFile(join(dir, 'skill.json'), JSON.stringify({
      name: 'test-skill',
      description: 'A test',
      version: '1.0.0',
      agents: ['claude-code'],
    }));
    const result = await loadManifest(dir);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('test-skill');
    expect(result!.skills).toBeUndefined();
  });

  it('loads workspace manifest with skills array', async () => {
    await mkdir(join(dir, 'skills/foo'), { recursive: true });
    await writeFile(join(dir, 'skills/foo/SKILL.md'), '---\nname: foo\n---\n# Foo');
    await writeFile(join(dir, 'skill.json'), JSON.stringify({
      name: '@test/skills',
      namespace: '@test',
      skills: [{ path: 'skills/foo', name: 'foo', description: 'Foo skill' }],
    }));
    const result = await loadManifest(dir);
    expect(result).not.toBeNull();
    expect(result!.skills).toHaveLength(1);
    expect(result!.skills![0].name).toBe('foo');
  });

  it('validates namespace format', async () => {
    await writeFile(join(dir, 'skill.json'), JSON.stringify({
      name: 'test', description: 'test', namespace: 'invalid',
    }));
    await expect(loadManifest(dir)).rejects.toThrow('namespace');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/cli && npx vitest run tests/unit/manifest.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement manifest loader**

Create `packages/cli/src/lib/manifest.ts`:

```typescript
import { readFile } from 'fs/promises';
import { join } from 'path';
import type { SkillManifest } from '@skillr/shared';

const NS_REGEX = /^@[a-z0-9][a-z0-9-]*$/;

export async function loadManifest(dir: string): Promise<SkillManifest | null> {
  const path = join(dir, 'skill.json');
  let content: string;
  try {
    content = await readFile(path, 'utf-8');
  } catch {
    return null;
  }

  const manifest: SkillManifest = JSON.parse(content);

  if (!manifest.name) {
    throw new Error('skill.json: "name" is required');
  }

  if (manifest.namespace && !NS_REGEX.test(manifest.namespace)) {
    throw new Error(`skill.json: invalid namespace "${manifest.namespace}" — must match ${NS_REGEX}`);
  }

  if (!manifest.skills && !manifest.description) {
    throw new Error('skill.json: "description" is required in single-skill mode');
  }

  if (manifest.skills) {
    for (const entry of manifest.skills) {
      if (!entry.path) throw new Error(`skill.json: skill entry missing "path"`);
      if (!entry.name) throw new Error(`skill.json: skill entry at "${entry.path}" missing "name"`);
      if (!entry.description) throw new Error(`skill.json: skill entry at "${entry.path}" missing "description"`);
    }
  }

  return manifest;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/cli && npx vitest run tests/unit/manifest.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/lib/manifest.ts packages/cli/tests/unit/manifest.test.ts
git commit -m "feat(cli): add skill.json manifest loader with validation"
```

---

### Task 4: CLI — update push command for skill.json support

**Files:**
- Modify: `packages/cli/src/commands/push.ts`

- [ ] **Step 1: Update packDirectory to accept file filters**

In `packages/cli/src/commands/push.ts`, update `packDirectory`:

```typescript
interface PackOptions {
  include?: string[];
  exclude?: string[];
}

async function packDirectory(dir: string, opts: PackOptions = {}): Promise<Buffer> {
  const includePattern = opts.include?.length ? opts.include : ['**/*'];
  const ignorePatterns = [
    ...IGNORE_PATTERNS,
    ...(opts.exclude || []),
  ];

  const files = await fg(includePattern, {
    cwd: dir,
    ignore: ignorePatterns,
    dot: true,
  });

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = tar.create({ gzip: true, cwd: dir }, files);
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}
```

- [ ] **Step 2: Rewrite pushSkill to support skill.json modes**

Replace the `pushSkill` function body:

```typescript
export async function pushSkill(
  skillRef: string | undefined,
  tag: string,
  output: OutputAdapter,
  configDir?: string,
): Promise<void> {
  const { loadManifest } = await import('../lib/manifest.js');
  const manifest = await loadManifest(process.cwd());

  // Load auth
  const config = await loadConfig(configDir);
  const source = getDefaultSource(config);
  if (!source) { output.error('No source configured.'); process.exitCode = 1; return; }
  const token = getAuthToken(source.url, config);
  if (!token) { output.error('Not authenticated.'); process.exitCode = 1; return; }
  const client = new RegistryClient(source.url, token);

  if (manifest?.skills) {
    // === Workspace mode ===
    await pushWorkspace(manifest, skillRef, tag, output, client);
  } else if (manifest) {
    // === Single-skill mode with skill.json ===
    await pushSingle(manifest, skillRef, tag, output, client);
  } else {
    // === Legacy mode (SKILL.md only) ===
    if (!skillRef) { output.error('No skill.json found. Usage: skillr push @namespace/skill-name'); process.exitCode = 1; return; }
    await pushLegacy(skillRef, tag, output, client);
  }
}
```

Then implement `pushWorkspace`, `pushSingle`, `pushLegacy` as separate functions. `pushLegacy` is the existing logic extracted. `pushSingle` and `pushWorkspace` use manifest data.

Key logic for namespace resolution:
```typescript
function resolveNamespace(ref: string | undefined, manifest: SkillManifest | null): string {
  if (ref && ref.startsWith('@') && ref.includes('/')) {
    return ref.split('/')[0];
  }
  if (manifest?.namespace) return manifest.namespace;
  return '@default';
}
```

Key logic for tag resolution:
```typescript
function resolveTag(explicitTag: string, manifest: SkillManifest | null): string {
  if (explicitTag !== 'latest') return explicitTag; // explicit --tag wins
  if (manifest?.version) return manifest.version;
  return 'latest';
}
```

- [ ] **Step 3: Update command registration**

Change `<ref>` to `[ref]`:

```typescript
export function registerPushCommand(program: Command): void {
  program
    .command('push')
    .description('Push skill(s) to the registry')
    .argument('[ref]', 'Skill reference, path, or omit to push all (with skill.json)')
    .option('-t, --tag <tag>', 'Version tag', 'latest')
    .action(async (ref: string | undefined, opts: { tag: string }) => {
      const output = createOutput({ json: program.opts().json });
      await pushSkill(ref, opts.tag, output);
    });
}
```

- [ ] **Step 4: Verify existing tests still pass**

Run: `cd packages/cli && npx vitest run`
Expected: all 62 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/push.ts
git commit -m "feat(cli): support skill.json in push command (workspace, single, legacy modes)"
```

---

### Task 5: CLI — update scan command for skill.json

**Files:**
- Modify: `packages/cli/src/commands/scan.ts`

- [ ] **Step 1: Update scanDirectory to check skill.json first**

```typescript
export async function scanDirectory(directory: string): Promise<ScannedSkill[]> {
  const { loadManifest } = await import('../lib/manifest.js');

  try {
    const manifest = await loadManifest(directory);
    if (manifest?.skills) {
      return scanFromManifest(directory, manifest);
    }
    if (manifest) {
      // Single-skill mode — validate root
      return scanSingleManifest(directory, manifest);
    }
  } catch (err: any) {
    return [{ path: 'skill.json', directory: '.', errors: [err.message], valid: false }];
  }

  // Legacy: scan for SKILL.md files
  // ... existing code ...
}
```

`scanFromManifest` validates each skill entry's path and SKILL.md existence, returns `ScannedSkill[]` in the same format.

- [ ] **Step 2: Run existing scan tests**

Run: `cd packages/cli && npx vitest run tests/unit/scan.test.ts`
Expected: PASS (backward compatible)

- [ ] **Step 3: Commit**

```bash
git add packages/cli/src/commands/scan.ts
git commit -m "feat(cli): scan validates skill.json entries when present"
```

---

### Task 6: CLI — add `skillr init` command

**Files:**
- Create: `packages/cli/src/commands/init.ts`
- Modify: `packages/cli/src/index.ts` — register init command

- [ ] **Step 1: Implement init command**

Create `packages/cli/src/commands/init.ts` — non-interactive for now (agent-friendly):

```typescript
import { Command } from 'commander';
import { writeFile, mkdir } from 'fs/promises';
import { join, existsSync } from 'path';
import { createOutput } from '../lib/output.js';

const SKILL_MD_TEMPLATE = `---
name: example
description: Describe your skill
version: 1.0.0
---

# Example Skill

Describe what this skill does and how to use it.
`;

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize a new skill project with skill.json')
    .option('--workspace', 'Create a workspace project with multiple skills')
    .option('--name <name>', 'Project/skill name')
    .option('--namespace <ns>', 'Default namespace (e.g., @default)')
    .action(async (opts) => {
      const output = createOutput({ json: program.opts().json });
      const cwd = process.cwd();
      const name = opts.name || 'my-skill';
      const ns = opts.namespace || '@default';

      if (opts.workspace) {
        const manifest = {
          name: `${ns}/${name}`,
          version: '1.0.0',
          namespace: ns,
          skills: [
            { path: 'skills/example', name: 'example', description: 'An example skill' },
          ],
        };
        await writeFile(join(cwd, 'skill.json'), JSON.stringify(manifest, null, 2) + '\n');
        await mkdir(join(cwd, 'skills/example'), { recursive: true });
        await writeFile(join(cwd, 'skills/example/SKILL.md'), SKILL_MD_TEMPLATE);
        output.success('Created skill.json (workspace mode)');
        output.success('Created skills/example/SKILL.md');
      } else {
        const manifest = {
          name,
          description: 'Describe your skill',
          version: '1.0.0',
          namespace: ns,
          agents: ['claude-code'],
        };
        await writeFile(join(cwd, 'skill.json'), JSON.stringify(manifest, null, 2) + '\n');
        await writeFile(join(cwd, 'SKILL.md'), SKILL_MD_TEMPLATE);
        output.success('Created skill.json');
        output.success('Created SKILL.md');
      }
    });
}
```

- [ ] **Step 2: Register in index.ts**

In `packages/cli/src/index.ts`, add:
```typescript
import { registerInitCommand } from './commands/init.js';
// ...
registerInitCommand(program);
```

- [ ] **Step 3: Test manually**

```bash
cd /tmp && mkdir test-init && cd test-init && node /path/to/cli/dist/index.js init --name test-skill
```

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/commands/init.ts packages/cli/src/index.ts
git commit -m "feat(cli): add skillr init command for scaffolding skill.json"
```

---

### Task 7: CLI — update search command with agent/tag filters

**Files:**
- Modify: `packages/cli/src/commands/search.ts`
- Modify: `packages/cli/src/lib/registry-client.ts`

- [ ] **Step 1: Add filter options to search command**

In `packages/cli/src/commands/search.ts`, add `--agent` and `--tag` options:

```typescript
.option('--agent <agent>', 'Filter by agent compatibility (e.g., claude-code)')
.option('--tag <tag>', 'Filter by search tag')
```

- [ ] **Step 2: Update RegistryClient.searchSkills to pass filters**

In `packages/cli/src/lib/registry-client.ts`, add query params:

```typescript
async searchSkills(query: string, opts?: { agent?: string; tag?: string }) {
  const params = new URLSearchParams({ q: query });
  if (opts?.agent) params.set('agent', opts.agent);
  if (opts?.tag) params.set('tag', opts.tag);
  // ... rest
}
```

- [ ] **Step 3: Update backend search route to read filters**

In `apps/api/src/routes/skills.ts`, the search handler reads `agent` and `tag` query params:

```typescript
const agent = c.req.query('agent');
const tag = c.req.query('tag');
const results = await skillService.searchSkills(q, ns, page, limit, userId, agent, tag);
```

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/commands/search.ts packages/cli/src/lib/registry-client.ts apps/api/src/routes/skills.ts
git commit -m "feat: add agent and tag filters to skill search"
```

---

### Task 8: Deploy and end-to-end test

**Files:** None (deployment and verification only)

- [ ] **Step 1: Build shared**

```bash
pnpm --filter @skillr/shared build
```

- [ ] **Step 2: Typecheck all**

```bash
cd apps/api && npx tsc --noEmit
cd ../../packages/cli && npx tsc --noEmit
```

- [ ] **Step 3: Run all tests**

```bash
pnpm -r test
```

- [ ] **Step 4: Deploy backend**

```bash
cd apps/api && npx wrangler deploy --domain api.skillhub.tokenroll.ai
```

- [ ] **Step 5: Run D1 migration**

```bash
cd apps/api && wrangler d1 execute skillr-db --remote --file=migrations/0001-skill-metadata.sql
```

- [ ] **Step 6: E2E test — init, push, search, install**

```bash
# Init workspace
cd /tmp && mkdir e2e-test && cd e2e-test
skillr init --workspace --name test-skills --namespace @default

# Push
skillr push

# Search with filters
skillr search example
skillr search example --agent claude-code

# Install
cd /tmp && mkdir install-test && cd install-test
skillr install @default/example
```

- [ ] **Step 7: Commit all remaining changes**

```bash
git add -A && git commit -m "feat: skill.json manifest support — workspace publishing, metadata, search filters"
```
