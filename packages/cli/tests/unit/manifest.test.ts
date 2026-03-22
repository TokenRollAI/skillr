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

  it('throws when name is missing', async () => {
    await writeFile(join(dir, 'skill.json'), JSON.stringify({ description: 'test' }));
    await expect(loadManifest(dir)).rejects.toThrow('name');
  });

  it('throws when single-skill has no description', async () => {
    await writeFile(join(dir, 'skill.json'), JSON.stringify({ name: 'test' }));
    await expect(loadManifest(dir)).rejects.toThrow('description');
  });

  it('throws on malformed JSON', async () => {
    await writeFile(join(dir, 'skill.json'), '{ invalid json }');
    await expect(loadManifest(dir)).rejects.toThrow('invalid JSON');
  });

  it('throws when workspace skill entry missing description', async () => {
    await writeFile(join(dir, 'skill.json'), JSON.stringify({
      name: '@test/skills',
      skills: [{ path: 'skills/foo', name: 'foo' }],
    }));
    await expect(loadManifest(dir)).rejects.toThrow('description');
  });

  it('throws when workspace skill entry missing path', async () => {
    await writeFile(join(dir, 'skill.json'), JSON.stringify({
      name: '@test/skills',
      skills: [{ name: 'foo', description: 'test' }],
    }));
    await expect(loadManifest(dir)).rejects.toThrow('path');
  });
});
