import { Command } from 'commander';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { createHash } from 'crypto';
import * as tar from 'tar';
import matter from 'gray-matter';
import fg from 'fast-glob';
import { loadConfig, getDefaultSource, getAuthToken } from '../lib/config.js';
import { RegistryClient } from '../lib/registry-client.js';
import { createOutput, type OutputAdapter } from '../lib/output.js';
import type { SkillManifest } from '@skillr/shared';

const IGNORE_PATTERNS = [
  'node_modules/**',
  '.git/**',
  'dist/**',
  'build/**',
  '.next/**',
  'coverage/**',
  '.turbo/**',
  '*.tar.gz',
];

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

function resolveNamespace(ref: string | undefined, manifest: SkillManifest | null): string {
  if (ref && ref.startsWith('@') && ref.includes('/')) {
    return ref.split('/')[0]!;
  }
  if (manifest?.namespace) return manifest.namespace;
  return '@default';
}

function resolveSkillName(ref: string | undefined, manifest: SkillManifest | null): string | undefined {
  if (ref && ref.includes('/')) {
    return ref.split('/').pop();
  }
  if (ref) return ref;
  if (manifest && !manifest.skills) return manifest.name;
  return undefined;
}

function resolveTag(explicitTag: string, manifest: SkillManifest | null): string {
  if (explicitTag !== 'latest') return explicitTag;
  if (manifest?.version) return manifest.version;
  return 'latest';
}

export async function pushSkill(
  skillRef: string | undefined,
  tag: string,
  output: OutputAdapter,
  configDir?: string,
): Promise<void> {
  const { loadManifest } = await import('../lib/manifest.js');
  const manifest = await loadManifest(process.cwd());

  const config = await loadConfig(configDir);
  const source = getDefaultSource(config);
  if (!source) { output.error('No source configured.'); process.exitCode = 1; return; }
  const token = getAuthToken(source.url, config);
  if (!token) { output.error('Not authenticated. Run `skillr login` first.'); process.exitCode = 1; return; }
  const client = new RegistryClient(source.url, token);

  if (manifest?.skills) {
    await pushWorkspace(manifest, skillRef, tag, output, client);
  } else if (manifest) {
    await pushSingle(manifest, skillRef, tag, output, client);
  } else {
    if (!skillRef) { output.error('No skill.json found. Usage: skillr push @namespace/skill-name'); process.exitCode = 1; return; }
    await pushLegacy(skillRef, tag, output, client);
  }
}

async function pushSingle(
  manifest: SkillManifest,
  ref: string | undefined,
  explicitTag: string,
  output: OutputAdapter,
  client: RegistryClient,
): Promise<void> {
  const namespace = resolveNamespace(ref, manifest);
  const skillName = resolveSkillName(ref, manifest) || manifest.name;
  const tag = resolveTag(explicitTag, manifest);
  const cwd = process.cwd();

  // Read SKILL.md if present
  let skillMdContent: string | undefined;
  try {
    skillMdContent = await readFile(join(cwd, 'SKILL.md'), 'utf-8');
  } catch {}

  output.info(`Packing ${namespace}/${skillName}...`);
  const tarball = await packDirectory(cwd, { include: manifest.files?.include, exclude: manifest.files?.exclude });
  const checksum = createHash('sha256').update(tarball).digest('hex');
  output.info(`Tarball size: ${(tarball.length / 1024).toFixed(1)} KB (sha256: ${checksum.slice(0, 12)}...)`);

  try {
    const result = await client.pushSkill(namespace, skillName, tarball, tag, {
      description: manifest.description,
      readme: skillMdContent,
      metadata: {
        author: manifest.author,
        license: manifest.license,
        repository: manifest.repository,
        agents: manifest.agents,
        tags: manifest.tags,
        dependencies: manifest.dependencies,
      },
    });
    output.success(`Published ${result.name}:${result.tag} (${result.size} bytes)`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    output.error(`Push failed: ${message}`);
    process.exitCode = 1;
  }
}

async function pushWorkspace(
  manifest: SkillManifest,
  ref: string | undefined,
  explicitTag: string,
  output: OutputAdapter,
  client: RegistryClient,
): Promise<void> {
  const entries = manifest.skills!;
  const namespace = resolveNamespace(ref, manifest);
  const tag = resolveTag(explicitTag, manifest);

  // Filter to single skill if ref is a path
  const toPublish = ref && !ref.startsWith('@')
    ? entries.filter(e => e.path === ref || e.name === ref)
    : entries;

  if (toPublish.length === 0) {
    output.error(`No matching skill found for "${ref}"`);
    process.exitCode = 1;
    return;
  }

  let succeeded = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const entry of toPublish) {
    const skillDir = join(process.cwd(), entry.path);
    const skillName = entry.name;

    // Read SKILL.md
    let skillMdContent: string | undefined;
    try {
      skillMdContent = await readFile(join(skillDir, 'SKILL.md'), 'utf-8');
    } catch {
      output.warn(`${entry.path}: No SKILL.md found, skipping`);
      failed++;
      failures.push(entry.path);
      continue;
    }

    output.info(`Packing ${namespace}/${skillName} (${entry.path})...`);
    const packOpts = { include: entry.files?.include, exclude: entry.files?.exclude };
    const tarball = await packDirectory(skillDir, packOpts);
    const checksum = createHash('sha256').update(tarball).digest('hex');

    try {
      const result = await client.pushSkill(namespace, skillName, tarball, tag, {
        description: entry.description,
        readme: skillMdContent,
        metadata: {
          author: manifest.author,
          license: manifest.license,
          repository: manifest.repository,
          agents: entry.agents || manifest.agents,
          tags: entry.tags,
          dependencies: entry.dependencies,
        },
      });
      output.success(`Published ${result.name}:${result.tag} (${result.size} bytes)`);
      succeeded++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      output.error(`Failed to push ${namespace}/${skillName}: ${message}`);
      failed++;
      failures.push(entry.path);
    }
  }

  if (toPublish.length > 1) {
    output.info(`Published ${succeeded}/${toPublish.length} skills.${failed > 0 ? ` ${failed} failed: ${failures.join(', ')}` : ''}`);
  }
  if (failed > 0) process.exitCode = 1;
}

async function pushLegacy(
  skillRef: string,
  tag: string,
  output: OutputAdapter,
  client: RegistryClient,
): Promise<void> {
  // Support short name without namespace - default to @default
  let actualRef = skillRef;
  if (!skillRef.includes('/')) {
    actualRef = `@default/${skillRef}`;
    output.info(`Using default namespace: ${actualRef}`);
  }

  // Parse @namespace/skill-name
  const match = actualRef.match(/^(@[a-z0-9][a-z0-9-]*)\/([a-z0-9][a-z0-9._-]*)$/);
  if (!match) {
    output.error('Invalid skill reference. Format: @namespace/skill-name');
    process.exitCode = 1;
    return;
  }
  const [, namespace, skillName] = match;

  // Find SKILL.md in current directory
  const skillMdPath = join(process.cwd(), 'SKILL.md');
  let skillMdContent: string;
  try {
    skillMdContent = await readFile(skillMdPath, 'utf-8');
  } catch {
    output.error('No SKILL.md found in current directory.');
    process.exitCode = 1;
    return;
  }

  // Lint SKILL.md
  const { data: frontmatter } = matter(skillMdContent);
  if (!frontmatter.name) {
    output.error('SKILL.md is missing required field: name');
    process.exitCode = 1;
    return;
  }
  if (!frontmatter.description) {
    output.error('SKILL.md is missing required field: description');
    process.exitCode = 1;
    return;
  }

  output.info(`Packing ${namespace}/${skillName}...`);

  // Pack directory
  const tarball = await packDirectory(process.cwd());
  const checksum = createHash('sha256').update(tarball).digest('hex');

  output.info(`Tarball size: ${(tarball.length / 1024).toFixed(1)} KB (sha256: ${checksum.slice(0, 12)}...)`);

  // Push
  try {
    const result = await client.pushSkill(namespace!, skillName!, tarball, tag, {
      description: frontmatter.description as string,
      readme: skillMdContent,
      metadata: frontmatter as Record<string, unknown>,
    });
    output.success(`Published ${result.name}:${result.tag} (${result.size} bytes)`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    output.error(`Push failed: ${message}`);
    process.exitCode = 1;
  }
}

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
