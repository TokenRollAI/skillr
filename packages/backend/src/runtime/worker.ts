import type { Runtime, PasswordHasher, StorageAdapter } from './types.js';

class WorkerPasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    // Use PBKDF2 via Web Crypto
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits'],
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      key,
      256,
    );
    const hashBytes = new Uint8Array(bits);
    // Format: $pbkdf2$salt$hash (both hex encoded)
    const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
    const hashHex = Array.from(hashBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    return `$pbkdf2$${saltHex}$${hashHex}`;
  }

  async verify(storedHash: string, password: string): Promise<boolean> {
    // Support both argon2 format (starts with $argon2) and pbkdf2 format
    if (storedHash.startsWith('$argon2')) {
      // Cannot verify argon2 hashes in Workers — reject
      throw new Error('argon2 hashes cannot be verified in Workers runtime. User must reset password.');
    }

    const parts = storedHash.split('$');
    if (parts[1] !== 'pbkdf2') throw new Error('Unknown hash format');
    const salt = new Uint8Array(parts[2]!.match(/.{2}/g)!.map(b => parseInt(b, 16)));
    const expectedHash = parts[3]!;

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits'],
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      key,
      256,
    );
    const actualHash = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
    return actualHash === expectedHash;
  }
}

class R2StorageAdapter implements StorageAdapter {
  constructor(private r2: any) {} // R2Bucket binding

  async upload(key: string, body: Buffer | ArrayBuffer, contentType = 'application/gzip'): Promise<void> {
    await this.r2.put(key, body, { httpMetadata: { contentType } });
  }

  async download(key: string): Promise<ArrayBuffer | null> {
    const obj = await this.r2.get(key);
    if (!obj) return null;
    return obj.arrayBuffer();
  }

  async getSignedUrl(key: string, _expiresIn = 3600): Promise<string> {
    // R2 doesn't have presigned URLs in the same way
    // Return a proxy URL that goes through the worker
    return `/api/skills/download/${encodeURIComponent(key)}`;
  }

  async delete(key: string): Promise<void> {
    await this.r2.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    const obj = await this.r2.head(key);
    return obj !== null;
  }
}

export function createWorkerRuntime(env: { ARTIFACTS: any }): Runtime {
  return {
    password: new WorkerPasswordHasher(),
    storage: new R2StorageAdapter(env.ARTIFACTS),
  };
}
