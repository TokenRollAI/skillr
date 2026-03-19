import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { loginFlow, logout, whoami, authStatus } from '../../src/commands/auth.js';
import { saveConfig, loadConfig } from '../../src/lib/config.js';
import { JsonOutput } from '../../src/lib/output.js';
import type { SkillrConfig } from '@skillr/shared';

describe('auth commands', () => {
  let tempDir: string;
  let output: JsonOutput;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let originalFetch: typeof globalThis.fetch;
  let originalEnv: NodeJS.ProcessEnv;

  const baseConfig: SkillrConfig = {
    sources: [{ name: 'default', url: 'https://hub.skillr.dev', default: true }],
    auth: {},
    telemetry: true,
  };

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'skillhub-test-'));
    output = new JsonOutput();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    originalFetch = globalThis.fetch;
    originalEnv = { ...process.env };
    process.exitCode = undefined;
    await saveConfig(baseConfig, tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  function mockFetch(responses: Array<{ status: number; body?: unknown }>) {
    let callIndex = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      const resp = responses[callIndex] ?? responses[responses.length - 1]!;
      callIndex++;
      return Promise.resolve({
        ok: resp.status >= 200 && resp.status < 300,
        status: resp.status,
        statusText: resp.status === 200 ? 'OK' : 'Error',
        json: () => Promise.resolve(resp.body),
      });
    });
  }

  const noSleep = async () => {};

  describe('loginFlow', () => {
    it('should request device code and poll for token', async () => {
      mockFetch([
        {
          status: 200,
          body: {
            device_code: 'dc-123',
            user_code: 'ABCD-1234',
            verification_uri: 'https://hub.skillr.dev/device',
            expires_in: 900,
            interval: 5,
          },
        },
        {
          status: 200,
          body: { access_token: 'token-abc', token_type: 'Bearer', expires_in: 3600 },
        },
      ]);

      await loginFlow(undefined, output, tempDir, noSleep);

      expect(process.exitCode).toBeUndefined();
      const config = await loadConfig(tempDir);
      expect(config.auth['https://hub.skillr.dev']?.token).toBe('token-abc');
    });

    it('should handle network errors gracefully', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await loginFlow(undefined, output, tempDir, noSleep);
      expect(process.exitCode).toBe(1);
    });

    it('should error on non-existent source', async () => {
      await loginFlow('nonexistent', output, tempDir, noSleep);
      expect(process.exitCode).toBe(1);
    });
  });

  describe('logout', () => {
    it('should clear token', async () => {
      const configWithAuth: SkillrConfig = {
        ...baseConfig,
        auth: {
          'https://hub.skillr.dev': { token: 'test-token', type: 'device_code' },
        },
      };
      await saveConfig(configWithAuth, tempDir);

      await logout(undefined, output, tempDir);
      expect(process.exitCode).toBeUndefined();

      const config = await loadConfig(tempDir);
      expect(config.auth['https://hub.skillr.dev']).toBeUndefined();
    });

    it('should warn when not logged in', async () => {
      await logout(undefined, output, tempDir);
      expect(process.exitCode).toBeUndefined();
      // Should have a warn call
      const calls = consoleSpy.mock.calls.map((c) => JSON.parse(c[0] as string));
      expect(calls.some((c) => c.type === 'warn')).toBe(true);
    });
  });

  describe('whoami', () => {
    it('should show user info when authenticated', async () => {
      const configWithAuth: SkillrConfig = {
        ...baseConfig,
        auth: {
          'https://hub.skillr.dev': { token: 'test-token', type: 'device_code' },
        },
      };
      await saveConfig(configWithAuth, tempDir);

      mockFetch([{
        status: 200,
        body: { id: '1', username: 'testuser', email: 'test@test.com', role: 'viewer' },
      }]);

      delete process.env.SKILLHUB_TOKEN;
      await whoami(undefined, output, tempDir);
      expect(process.exitCode).toBeUndefined();
    });

    it('should error when not authenticated', async () => {
      delete process.env.SKILLHUB_TOKEN;
      await whoami(undefined, output, tempDir);
      expect(process.exitCode).toBe(1);
    });

    it('should prioritize SKILLHUB_TOKEN env var', async () => {
      process.env.SKILLHUB_TOKEN = 'env-token';

      mockFetch([{
        status: 200,
        body: { id: '1', username: 'envuser', email: 'env@test.com', role: 'admin' },
      }]);

      await whoami(undefined, output, tempDir);
      expect(process.exitCode).toBeUndefined();

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer env-token',
          }),
        }),
      );
    });
  });

  describe('authStatus', () => {
    it('should list all sources with auth status', async () => {
      await authStatus(output, tempDir);
      const calls = consoleSpy.mock.calls.map((c) => JSON.parse(c[0] as string));
      const tableCall = calls.find((c) => c.type === 'table');
      expect(tableCall).toBeDefined();
      expect(tableCall.data).toHaveLength(1);
      expect(tableCall.data[0].Source).toBe('default');
    });
  });
});
