import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, writeFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  loadConfig,
  saveConfig,
  getDefaultSource,
  getAuthToken,
  getConfigDir,
} from '../../src/lib/config.js';
import type { SkillrConfig } from '@skillr/shared';

describe('config', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'skillhub-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('loadConfig', () => {
    it('should return default config when file does not exist', async () => {
      const config = await loadConfig(tempDir);
      expect(config.sources).toHaveLength(1);
      expect(config.sources[0]!.name).toBe('default');
      expect(config.sources[0]!.url).toBe('https://hub.skillr.dev');
      expect(config.sources[0]!.default).toBe(true);
      expect(config.auth).toEqual({});
      expect(config.telemetry).toBe(true);
    });

    it('should correctly read existing config', async () => {
      const existingConfig: SkillrConfig = {
        sources: [
          { name: 'custom', url: 'https://custom.example.com', default: true },
        ],
        auth: {
          'https://custom.example.com': {
            token: 'test-token',
            type: 'device_code',
          },
        },
        telemetry: false,
      };
      await writeFile(join(tempDir, 'config.json'), JSON.stringify(existingConfig));

      const config = await loadConfig(tempDir);
      expect(config.sources[0]!.name).toBe('custom');
      expect(config.auth['https://custom.example.com']!.token).toBe('test-token');
      expect(config.telemetry).toBe(false);
    });

    it('should return default config when file is corrupt JSON', async () => {
      await writeFile(join(tempDir, 'config.json'), '{ invalid json }}}');
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

      const config = await loadConfig(tempDir);

      expect(config.sources).toHaveLength(1);
      expect(config.sources[0]!.name).toBe('default');
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining('Warning'),
      );

      stderrSpy.mockRestore();
    });
  });

  describe('saveConfig', () => {
    it('should write config and read it back correctly', async () => {
      const config: SkillrConfig = {
        sources: [
          { name: 'test', url: 'https://test.example.com', default: true },
        ],
        auth: {},
        telemetry: true,
      };

      await saveConfig(config, tempDir);
      const loaded = await loadConfig(tempDir);

      expect(loaded.sources[0]!.name).toBe('test');
      expect(loaded.sources[0]!.url).toBe('https://test.example.com');
    });

    it('should auto-create config directory', async () => {
      const nestedDir = join(tempDir, 'nested', 'dir');
      const config: SkillrConfig = {
        sources: [{ name: 'default', url: 'https://hub.skillr.dev', default: true }],
        auth: {},
        telemetry: true,
      };

      await saveConfig(config, nestedDir);
      const content = await readFile(join(nestedDir, 'config.json'), 'utf-8');
      expect(JSON.parse(content)).toEqual(config);
    });
  });

  describe('getDefaultSource', () => {
    it('should return source with default=true', () => {
      const config: SkillrConfig = {
        sources: [
          { name: 'a', url: 'https://a.com' },
          { name: 'b', url: 'https://b.com', default: true },
        ],
        auth: {},
        telemetry: true,
      };
      const source = getDefaultSource(config);
      expect(source?.name).toBe('b');
    });

    it('should return first source when none is default', () => {
      const config: SkillrConfig = {
        sources: [
          { name: 'a', url: 'https://a.com' },
          { name: 'b', url: 'https://b.com' },
        ],
        auth: {},
        telemetry: true,
      };
      const source = getDefaultSource(config);
      expect(source?.name).toBe('a');
    });

    it('should return undefined when no sources', () => {
      const config: SkillrConfig = {
        sources: [],
        auth: {},
        telemetry: true,
      };
      const source = getDefaultSource(config);
      expect(source).toBeUndefined();
    });
  });

  describe('getAuthToken', () => {
    const originalEnv = process.env;

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should prioritize SKILLHUB_TOKEN env var', () => {
      process.env = { ...originalEnv, SKILLHUB_TOKEN: 'env-token' };
      const config: SkillrConfig = {
        sources: [],
        auth: {
          'https://test.com': { token: 'config-token', type: 'device_code' },
        },
        telemetry: true,
      };
      const token = getAuthToken('https://test.com', config);
      expect(token).toBe('env-token');
    });

    it('should fall back to config token when env var is not set', () => {
      process.env = { ...originalEnv };
      delete process.env.SKILLHUB_TOKEN;
      const config: SkillrConfig = {
        sources: [],
        auth: {
          'https://test.com': { token: 'config-token', type: 'device_code' },
        },
        telemetry: true,
      };
      const token = getAuthToken('https://test.com', config);
      expect(token).toBe('config-token');
    });

    it('should return undefined when no token available', () => {
      process.env = { ...originalEnv };
      delete process.env.SKILLHUB_TOKEN;
      const config: SkillrConfig = {
        sources: [],
        auth: {},
        telemetry: true,
      };
      const token = getAuthToken('https://test.com', config);
      expect(token).toBeUndefined();
    });
  });
});
