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
