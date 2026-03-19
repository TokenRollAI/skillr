import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('push command', () => {
  beforeEach(() => {
    process.exitCode = undefined;
  });

  afterEach(() => {
    process.exitCode = undefined;
  });

  it('should reject invalid skill references', async () => {
    const { pushSkill } = await import('../../src/commands/push.js');
    const { JsonOutput } = await import('../../src/lib/output.js');
    const output = new JsonOutput();
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await pushSkill('invalid-ref', 'latest', output);
    expect(process.exitCode).toBe(1);

    spy.mockRestore();
  });
});
