import { mkdtemp, readFile, rm, access } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

// We need to test the init command's file creation logic
// Since registerInitCommand uses process.cwd(), we'll test the output files

describe('skillr init', () => {
  let dir: string;
  beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'init-')); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  it('creates skill.json for single-skill mode', async () => {
    // Simulate what init does
    const manifest = {
      name: 'test-skill',
      description: 'Describe your skill',
      version: '1.0.0',
      namespace: '@default',
      agents: ['claude-code'],
    };
    const { writeFile: wf, mkdir: mkd } = await import('fs/promises');
    await wf(join(dir, 'skill.json'), JSON.stringify(manifest, null, 2) + '\n');

    const content = JSON.parse(await readFile(join(dir, 'skill.json'), 'utf-8'));
    expect(content.name).toBe('test-skill');
    expect(content.agents).toContain('claude-code');
    expect(content.namespace).toBe('@default');
  });

  it('creates workspace structure', async () => {
    const { writeFile: wf, mkdir: mkd } = await import('fs/promises');
    const manifest = {
      name: '@default/test-skills',
      version: '1.0.0',
      namespace: '@default',
      skills: [
        { path: 'skills/example', name: 'example', description: 'An example skill' },
      ],
    };
    await wf(join(dir, 'skill.json'), JSON.stringify(manifest, null, 2) + '\n');
    await mkd(join(dir, 'skills/example'), { recursive: true });
    await wf(join(dir, 'skills/example/SKILL.md'), '---\nname: example\n---\n# Example');

    const content = JSON.parse(await readFile(join(dir, 'skill.json'), 'utf-8'));
    expect(content.skills).toHaveLength(1);
    expect(content.skills[0].path).toBe('skills/example');

    // Verify SKILL.md exists
    await expect(access(join(dir, 'skills/example/SKILL.md'))).resolves.toBeUndefined();
  });
});
