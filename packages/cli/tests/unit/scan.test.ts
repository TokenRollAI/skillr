import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { scanDirectory } from '../../src/commands/scan.js';

describe('scan command', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'skillhub-scan-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should find SKILL.md files', async () => {
    // Create a valid SKILL.md
    const skillDir = join(tempDir, 'my-skill');
    await mkdir(skillDir, { recursive: true });
    await writeFile(join(skillDir, 'SKILL.md'), `---
name: my-skill
description: A test skill
version: 1.0.0
---
# My Skill
This is a test skill.
`);

    const results = await scanDirectory(tempDir);
    expect(results).toHaveLength(1);
    expect(results[0]!.name).toBe('my-skill');
    expect(results[0]!.description).toBe('A test skill');
    expect(results[0]!.valid).toBe(true);
    expect(results[0]!.errors).toHaveLength(0);
  });

  it('should ignore node_modules', async () => {
    const nmDir = join(tempDir, 'node_modules', 'some-pkg');
    await mkdir(nmDir, { recursive: true });
    await writeFile(join(nmDir, 'SKILL.md'), `---
name: ignored
description: should be ignored
---
`);

    const results = await scanDirectory(tempDir);
    expect(results).toHaveLength(0);
  });

  it('should report missing required fields as lint errors', async () => {
    const skillDir = join(tempDir, 'bad-skill');
    await mkdir(skillDir, { recursive: true });
    await writeFile(join(skillDir, 'SKILL.md'), `---
name: bad-skill
---
# Bad Skill
Missing description.
`);

    const results = await scanDirectory(tempDir);
    expect(results).toHaveLength(1);
    expect(results[0]!.valid).toBe(false);
    expect(results[0]!.errors).toContain('Missing required field: description');
  });

  it('should parse YAML frontmatter correctly', async () => {
    const skillDir = join(tempDir, 'complete-skill');
    await mkdir(skillDir, { recursive: true });
    await writeFile(join(skillDir, 'SKILL.md'), `---
name: complete-skill
description: A complete skill with all fields
version: 2.0.0
---
# Complete Skill
`);

    const results = await scanDirectory(tempDir);
    expect(results[0]!.name).toBe('complete-skill');
    expect(results[0]!.description).toBe('A complete skill with all fields');
    expect(results[0]!.version).toBe('2.0.0');
  });

  it('should return empty array when no SKILL.md found', async () => {
    const results = await scanDirectory(tempDir);
    expect(results).toHaveLength(0);
  });

  it('should find multiple SKILL.md files', async () => {
    for (const name of ['skill-a', 'skill-b', 'skill-c']) {
      const dir = join(tempDir, name);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'SKILL.md'), `---
name: ${name}
description: Skill ${name}
---
`);
    }

    const results = await scanDirectory(tempDir);
    expect(results).toHaveLength(3);
  });
});
