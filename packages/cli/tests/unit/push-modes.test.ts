import { mkdtemp, writeFile, mkdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { loadManifest } from '../../src/lib/manifest.js';

describe('push mode resolution', () => {
  let dir: string;
  beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'push-mode-')); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  it('returns null for legacy mode (no skill.json)', async () => {
    const manifest = await loadManifest(dir);
    expect(manifest).toBeNull();
  });

  it('detects single-skill mode (skill.json without skills array)', async () => {
    await writeFile(join(dir, 'skill.json'), JSON.stringify({
      name: 'test', description: 'test', version: '1.0.0',
    }));
    const manifest = await loadManifest(dir);
    expect(manifest).not.toBeNull();
    expect(manifest!.skills).toBeUndefined();
  });

  it('detects workspace mode (skill.json with skills array)', async () => {
    await writeFile(join(dir, 'skill.json'), JSON.stringify({
      name: '@test/skills',
      namespace: '@test',
      skills: [{ path: 'a', name: 'a', description: 'a' }],
    }));
    const manifest = await loadManifest(dir);
    expect(manifest).not.toBeNull();
    expect(manifest!.skills).toHaveLength(1);
  });

  it('inherits namespace from manifest', async () => {
    await writeFile(join(dir, 'skill.json'), JSON.stringify({
      name: 'test', description: 'test', namespace: '@myteam',
    }));
    const manifest = await loadManifest(dir);
    expect(manifest!.namespace).toBe('@myteam');
  });

  it('resolves version as tag', async () => {
    await writeFile(join(dir, 'skill.json'), JSON.stringify({
      name: 'test', description: 'test', version: '2.0.0',
    }));
    const manifest = await loadManifest(dir);
    expect(manifest!.version).toBe('2.0.0');
  });
});
