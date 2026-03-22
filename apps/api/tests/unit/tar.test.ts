import { describe, it, expect } from 'vitest';
import { createTarGz } from '../../src/lib/tar.js';

describe('tar utilities', () => {
  it('createTarGz returns valid gzip data (magic bytes 0x1f 0x8b)', async () => {
    const content = new TextEncoder().encode('hello world');
    const result = await createTarGz('test.txt', content);
    expect(result[0]).toBe(0x1f);
    expect(result[1]).toBe(0x8b);
  });

  it('output is larger than input due to tar header + gzip overhead', async () => {
    const content = new TextEncoder().encode('small');
    const result = await createTarGz('small.txt', content);
    // tar header (512) + data block (512) + end blocks (1024) = 2048 min before gzip
    // gzip of 2048 bytes of mostly zeros should still be > input length
    expect(result.byteLength).toBeGreaterThan(content.byteLength);
  });

  it('handles empty content correctly', async () => {
    const content = new Uint8Array(0);
    const result = await createTarGz('empty.txt', content);
    // Should still produce valid gzip output
    expect(result[0]).toBe(0x1f);
    expect(result[1]).toBe(0x8b);
    expect(result.byteLength).toBeGreaterThan(0);
  });
});
