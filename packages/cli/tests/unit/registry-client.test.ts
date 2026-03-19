import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RegistryClient } from '../../src/lib/registry-client.js';

describe('RegistryClient', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockFetch(response: { status: number; body?: unknown; statusText?: string }) {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      statusText: response.statusText ?? 'OK',
      json: () => Promise.resolve(response.body),
    });
  }

  it('should send Authorization header when token is provided', async () => {
    mockFetch({ status: 200, body: { id: '1', username: 'test', email: 'test@test.com', role: 'viewer' } });
    const client = new RegistryClient('https://api.test.com', 'my-token');

    await client.getUserInfo();

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.test.com/api/auth/me',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer my-token',
        }),
      }),
    );
  });

  it('should not send Authorization header when no token', async () => {
    mockFetch({ status: 200, body: { id: '1', username: 'test', email: 'test@test.com', role: 'viewer' } });
    const client = new RegistryClient('https://api.test.com');

    await client.getUserInfo();

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1] as RequestInit;
    const headers = callArgs.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it('should throw auth error on 401', async () => {
    mockFetch({ status: 401, statusText: 'Unauthorized' });
    const client = new RegistryClient('https://api.test.com', 'bad-token');

    await expect(client.getUserInfo()).rejects.toThrow('Authentication required');
  });

  it('should throw API error on 500', async () => {
    mockFetch({ status: 500, statusText: 'Internal Server Error' });
    const client = new RegistryClient('https://api.test.com');

    await expect(client.getUserInfo()).rejects.toThrow('API error: 500');
  });

  it('requestDeviceCode should POST to correct endpoint', async () => {
    mockFetch({
      status: 200,
      body: {
        device_code: 'dc-123',
        user_code: 'ABCD-1234',
        verification_uri: 'https://test.com/device',
        expires_in: 900,
        interval: 5,
      },
    });
    const client = new RegistryClient('https://api.test.com');

    const result = await client.requestDeviceCode();

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.test.com/api/auth/device/code',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.device_code).toBe('dc-123');
    expect(result.user_code).toBe('ABCD-1234');
  });

  it('pollDeviceToken should send correct body', async () => {
    mockFetch({
      status: 200,
      body: { access_token: 'token-123', token_type: 'Bearer' },
    });
    const client = new RegistryClient('https://api.test.com');

    await client.pollDeviceToken('dc-123');

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(callArgs.body as string);
    expect(body.device_code).toBe('dc-123');
    expect(body.grant_type).toBe('urn:ietf:params:oauth:grant-type:device_code');
  });
});
