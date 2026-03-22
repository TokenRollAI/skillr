import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/lib/password.js';

describe('password hashing', () => {
  it('hashPassword returns correct format (iterations:salt:hash)', async () => {
    const hash = await hashPassword('test-password');
    const parts = hash.split(':');
    expect(parts).toHaveLength(3);

    const [iterations, salt, key] = parts;
    expect(iterations).toBe('100000');
    // salt is 16 bytes = 32 hex chars
    expect(salt).toHaveLength(32);
    expect(salt).toMatch(/^[0-9a-f]+$/);
    // key is 32 bytes = 64 hex chars
    expect(key).toHaveLength(64);
    expect(key).toMatch(/^[0-9a-f]+$/);
  });

  it('verifyPassword returns true for correct password', async () => {
    const password = 'correct-horse-battery-staple';
    const hash = await hashPassword(password);
    const result = await verifyPassword(hash, password);
    expect(result).toBe(true);
  });

  it('verifyPassword returns false for wrong password', async () => {
    const hash = await hashPassword('right-password');
    const result = await verifyPassword(hash, 'wrong-password');
    expect(result).toBe(false);
  });

  it('different passwords produce different hashes', async () => {
    const hash1 = await hashPassword('password-one');
    const hash2 = await hashPassword('password-two');
    expect(hash1).not.toBe(hash2);
  });

  it('verifyPassword returns false for malformed hash', async () => {
    expect(await verifyPassword('invalid', 'password')).toBe(false);
    expect(await verifyPassword('a:b', 'password')).toBe(false);
    expect(await verifyPassword('', 'password')).toBe(false);
  });
});
