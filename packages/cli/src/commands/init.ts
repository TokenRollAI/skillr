import { Command } from 'commander';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
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
