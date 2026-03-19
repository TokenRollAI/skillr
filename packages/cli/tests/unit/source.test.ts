import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { listSources, addSource, removeSource, setDefaultSource, isValidUrl } from '../../src/commands/source.js';
import { loadConfig, saveConfig } from '../../src/lib/config.js';
import { JsonOutput } from '../../src/lib/output.js';
import type { SkillrConfig } from '@skillr/shared';

describe('source commands', () => {
  let tempDir: string;
  let output: JsonOutput;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'skillhub-test-'));
    output = new JsonOutput();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.exitCode = undefined;
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  describe('isValidUrl', () => {
    it('should accept valid http URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://localhost:3000')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('ftp://example.com')).toBe(false);
    });
  });

  describe('listSources', () => {
    it('should list empty sources on fresh config', async () => {
      await listSources(output, tempDir);
      expect(consoleSpy).toHaveBeenCalled();
      const parsed = JSON.parse(consoleSpy.mock.calls[0]![0] as string);
      expect(parsed.type).toBe('table');
      expect(parsed.data).toHaveLength(0);
    });
  });

  describe('addSource', () => {
    it('should successfully add a new source', async () => {
      await addSource('test', 'https://test.example.com', output, tempDir);
      expect(process.exitCode).toBeUndefined();

      const config = await loadConfig(tempDir);
      expect(config.sources).toHaveLength(1);
      expect(config.sources[0]!.name).toBe('test');
    });

    it('should reject invalid URL', async () => {
      await addSource('test', 'not-a-url', output, tempDir);
      expect(process.exitCode).toBe(1);
    });

    it('should reject duplicate name', async () => {
      await addSource('test', 'https://test.example.com', output, tempDir);
      process.exitCode = undefined;
      vi.clearAllMocks();
      consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await addSource('test', 'https://other.example.com', output, tempDir);
      expect(process.exitCode).toBe(1);
    });

    it('should reject duplicate URL', async () => {
      await addSource('test1', 'https://test.example.com', output, tempDir);
      process.exitCode = undefined;
      vi.clearAllMocks();
      consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await addSource('test2', 'https://test.example.com', output, tempDir);
      expect(process.exitCode).toBe(1);
    });
  });

  describe('removeSource', () => {
    it('should successfully remove a source', async () => {
      await addSource('first', 'https://first.example.com', output, tempDir);
      await addSource('second', 'https://second.example.com', output, tempDir);
      process.exitCode = undefined;
      vi.clearAllMocks();
      consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await removeSource('second', output, tempDir);
      expect(process.exitCode).toBeUndefined();

      const config = await loadConfig(tempDir);
      expect(config.sources).toHaveLength(1);
      expect(config.sources[0]!.name).toBe('first');
    });

    it('should refuse to remove the last source', async () => {
      await addSource('only', 'https://only.example.com', output, tempDir);
      process.exitCode = undefined;
      await removeSource('only', output, tempDir);
      expect(process.exitCode).toBe(1);
    });

    it('should error on non-existent name', async () => {
      await removeSource('nonexistent', output, tempDir);
      expect(process.exitCode).toBe(1);
    });
  });

  describe('setDefaultSource', () => {
    it('should successfully set default source', async () => {
      await addSource('first', 'https://first.example.com', output, tempDir);
      await addSource('second', 'https://second.example.com', output, tempDir);
      process.exitCode = undefined;
      vi.clearAllMocks();
      consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await setDefaultSource('second', output, tempDir);
      expect(process.exitCode).toBeUndefined();

      const config = await loadConfig(tempDir);
      const secondSource = config.sources.find((s) => s.name === 'second');
      expect(secondSource?.default).toBe(true);
      const firstSource = config.sources.find((s) => s.name === 'first');
      expect(firstSource?.default).toBe(false);
    });

    it('should error on non-existent name', async () => {
      await setDefaultSource('nonexistent', output, tempDir);
      expect(process.exitCode).toBe(1);
    });
  });
});
