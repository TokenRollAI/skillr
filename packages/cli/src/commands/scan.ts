import { Command } from 'commander';
import fg from 'fast-glob';
import matter from 'gray-matter';
import { readFile } from 'fs/promises';
import { join, dirname, relative } from 'path';
import { createOutput, type OutputAdapter } from '../lib/output.js';

export interface ScannedSkill {
  path: string;            // relative path to SKILL.md
  directory: string;       // directory containing SKILL.md
  name?: string;           // from frontmatter
  description?: string;    // from frontmatter
  version?: string;        // from frontmatter
  errors: string[];        // lint errors
  valid: boolean;
}

const IGNORE_DIRS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/coverage/**',
  '**/.turbo/**',
];

const REQUIRED_FIELDS = ['name', 'description'];

export async function scanDirectory(directory: string): Promise<ScannedSkill[]> {
  // Check for skill.json first
  const { loadManifest } = await import('../lib/manifest.js');
  try {
    const manifest = await loadManifest(directory);
    if (manifest?.skills) {
      // Workspace mode: validate each skill entry
      const results: ScannedSkill[] = [];
      for (const entry of manifest.skills) {
        const skillDir = join(directory, entry.path);
        const skillMdPath = join(skillDir, 'SKILL.md');
        const errors: string[] = [];

        try {
          const content = await readFile(skillMdPath, 'utf-8');
          const { data: frontmatter } = matter(content);
          // Validate SKILL.md has required fields or skill.json entry provides them
          if (!entry.name && !frontmatter.name) errors.push('Missing required field: name');
          if (!entry.description && !frontmatter.description) errors.push('Missing required field: description');
        } catch {
          errors.push('SKILL.md not found in ' + entry.path);
        }

        results.push({
          path: join(entry.path, 'SKILL.md'),
          directory: entry.path,
          name: entry.name,
          description: entry.description,
          version: manifest.version,
          errors,
          valid: errors.length === 0,
        });
      }
      return results;
    }
    if (manifest) {
      // Single-skill mode: validate root
      const skillMdPath = join(directory, 'SKILL.md');
      const errors: string[] = [];
      let frontmatter: Record<string, any> = {};
      try {
        const content = await readFile(skillMdPath, 'utf-8');
        frontmatter = matter(content).data;
      } catch {
        errors.push('SKILL.md not found');
      }

      return [{
        path: 'SKILL.md',
        directory: '.',
        name: manifest.name,
        description: manifest.description,
        version: manifest.version,
        errors,
        valid: errors.length === 0,
      }];
    }
  } catch (err: any) {
    return [{ path: 'skill.json', directory: '.', errors: [err.message], valid: false }];
  }

  // Legacy: scan for SKILL.md files (existing code below)
  const pattern = join(directory, '**/SKILL.md');
  const files = await fg(pattern, { ignore: IGNORE_DIRS, absolute: true });

  const results: ScannedSkill[] = [];

  for (const filePath of files) {
    const content = await readFile(filePath, 'utf-8');
    const { data: frontmatter } = matter(content);
    const errors: string[] = [];

    for (const field of REQUIRED_FIELDS) {
      if (!frontmatter[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    results.push({
      path: relative(directory, filePath),
      directory: relative(directory, dirname(filePath)),
      name: frontmatter.name as string | undefined,
      description: frontmatter.description as string | undefined,
      version: frontmatter.version as string | undefined,
      errors,
      valid: errors.length === 0,
    });
  }

  return results;
}

export function formatScanReport(skills: ScannedSkill[], output: OutputAdapter): void {
  if (skills.length === 0) {
    output.info('No SKILL.md files found in this directory.');
    return;
  }

  const valid = skills.filter((s) => s.valid);
  const invalid = skills.filter((s) => !s.valid);

  output.info(`Found ${skills.length} skill(s): ${valid.length} valid, ${invalid.length} with errors.`);
  output.info('');

  output.table(
    ['Directory', 'Name', 'Description', 'Status'],
    skills.map((s) => [
      s.directory || '.',
      s.name || '(missing)',
      s.description ? s.description.slice(0, 50) : '(missing)',
      s.valid ? 'OK' : `ERROR: ${s.errors.join(', ')}`,
    ]),
  );
}

export function registerScanCommand(program: Command): void {
  program
    .command('scan')
    .description('Scan for SKILL.md files in the current directory')
    .argument('[directory]', 'Directory to scan', '.')
    .action(async (directory: string) => {
      const output = createOutput({ json: program.opts().json });
      const skills = await scanDirectory(directory);

      if (program.opts().json) {
        output.json(skills);
      } else {
        formatScanReport(skills, output);
      }
    });
}
