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

async function packDirectory(dir: string): Promise<Buffer> {
  const files = await fg('**/*', {
    cwd: dir,
    ignore: IGNORE_PATTERNS,
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

export async function pushSkill(
  skillRef: string,
  tag: string,
  output: OutputAdapter,
  configDir?: string,
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

  // Check auth
  const config = await loadConfig(configDir);
  const source = getDefaultSource(config);
  if (!source) {
    output.error('No source configured.');
    process.exitCode = 1;
    return;
  }

  const token = getAuthToken(source.url, config);
  if (!token) {
    output.error('Not authenticated. Run `skillr auth login` first.');
    process.exitCode = 1;
    return;
  }

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
  output.info(`Pushing to ${source.url}...`);

  // Push
  const client = new RegistryClient(source.url, token);
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
    .description('Push a skill to the registry')
    .argument('<ref>', 'Skill reference (@namespace/skill-name or skill-name)')
    .option('-t, --tag <tag>', 'Version tag', 'latest')
    .action(async (ref: string, opts: { tag: string }) => {
      const output = createOutput({ json: program.opts().json });
      await pushSkill(ref, opts.tag, output);
    });
}
