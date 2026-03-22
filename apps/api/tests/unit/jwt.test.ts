import { describe, it, expect, beforeAll } from 'vitest';
import { signJwt, verifyJwt } from '../../src/utils/jwt.js';
import { setEnvFromBindings } from '../../src/env.js';

describe('JWT utilities', () => {
  beforeAll(() => {
    // Set up a test JWT secret via the env bindings mechanism
    setEnvFromBindings({
      JWT_SECRET: 'test-secret-key-for-unit-tests-only',
      FRONTEND_URL: 'http://localhost:3000',
      // Provide stubs for D1Database and R2Bucket since they are not used here
      DB: {} as any,
      ARTIFACTS: {} as any,
    });
  });

  it('signJwt generates a valid token string', async () => {
    const token = await signJwt({ sub: '1', username: 'alice', role: 'user' });
    expect(typeof token).toBe('string');
    // JWT has 3 base64url-encoded parts separated by dots
    expect(token.split('.')).toHaveLength(3);
  });

  it('verifyJwt can verify a token from signJwt', async () => {
    const payload = { sub: '42', username: 'bob', role: 'admin' };
    const token = await signJwt(payload);
    const decoded = await verifyJwt(token);
    expect(decoded.sub).toBe('42');
    expect(decoded.username).toBe('bob');
    expect(decoded.role).toBe('admin');
  });

  it('verifyJwt throws on a tampered token', async () => {
    const token = await signJwt({ sub: '1', username: 'alice', role: 'user' });
    // Tamper with the payload section (second part)
    const parts = token.split('.');
    parts[1] = parts[1] + 'tampered';
    const tamperedToken = parts.join('.');
    await expect(verifyJwt(tamperedToken)).rejects.toThrow();
  });

  it('payload contains correct sub, username, and role', async () => {
    const token = await signJwt({ sub: '99', username: 'charlie', role: 'publisher' });
    const decoded = await verifyJwt(token);
    expect(decoded).toMatchObject({
      sub: '99',
      username: 'charlie',
      role: 'publisher',
    });
  });
});
