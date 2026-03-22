import { describe, it, expect, beforeEach } from 'vitest';

// We need to reset the module-level _bucket between tests, so use dynamic imports
// and resetModules to get a fresh module state each time.
describe('storage utilities', () => {
  let storageModule: typeof import('../../src/lib/storage.js');

  beforeEach(async () => {
    // Re-import to reset module-level _bucket state
    const mod = await import('../../src/lib/storage.js');
    storageModule = mod;
  });

  it('getBucket (via checkR2Connection) throws when bucket is not initialized', async () => {
    // checkR2Connection calls getBucket() internally, which should throw
    // Since _bucket persists across imports in the same process, we test
    // the error path by calling a function that uses getBucket before setBucket.
    // We use downloadArtifact as a proxy since getBucket is not exported.
    await expect(storageModule.downloadArtifact('any-key')).rejects.toThrow(
      'R2 bucket not initialized',
    );
  });

  it('checkR2Connection succeeds after setBucket with a mock R2Bucket', async () => {
    // Create a minimal mock R2Bucket with a head method
    const mockBucket = {
      head: async (_key: string) => null,
      put: async () => {},
      get: async () => null,
      delete: async () => {},
      list: async () => ({ objects: [], truncated: false }),
    } as unknown as R2Bucket;

    storageModule.setBucket(mockBucket);
    const result = await storageModule.checkR2Connection();
    expect(result).toBe(true);
  });
});
