import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JsonOutput, TtyOutput, createOutput } from '../../src/lib/output.js';

describe('output', () => {
  describe('createOutput', () => {
    it('should return JsonOutput when json=true', () => {
      const output = createOutput({ json: true });
      expect(output).toBeInstanceOf(JsonOutput);
    });

    it('should return JsonOutput when stdout is not TTY', () => {
      const originalIsTTY = process.stdout.isTTY;
      Object.defineProperty(process.stdout, 'isTTY', { value: false, writable: true });
      const output = createOutput();
      expect(output).toBeInstanceOf(JsonOutput);
      Object.defineProperty(process.stdout, 'isTTY', { value: originalIsTTY, writable: true });
    });
  });

  describe('JsonOutput', () => {
    let output: JsonOutput;
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      output = new JsonOutput();
      consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    it('info should output valid JSON with type and message', () => {
      output.info('test message');
      expect(consoleSpy).toHaveBeenCalledOnce();
      const parsed = JSON.parse(consoleSpy.mock.calls[0]![0] as string);
      expect(parsed).toEqual({ type: 'info', message: 'test message' });
    });

    it('success should output valid JSON', () => {
      output.success('done');
      const parsed = JSON.parse(consoleSpy.mock.calls[0]![0] as string);
      expect(parsed).toEqual({ type: 'success', message: 'done' });
    });

    it('error should output JSON with type=error', () => {
      output.error('fail');
      const parsed = JSON.parse(consoleSpy.mock.calls[0]![0] as string);
      expect(parsed).toEqual({ type: 'error', message: 'fail' });
    });

    it('table should output JSON formatted table data', () => {
      output.table(['Name', 'URL'], [['test', 'https://test.com']]);
      const parsed = JSON.parse(consoleSpy.mock.calls[0]![0] as string);
      expect(parsed.type).toBe('table');
      expect(parsed.data).toEqual([{ Name: 'test', URL: 'https://test.com' }]);
    });

    it('json should output raw JSON', () => {
      output.json({ key: 'value' });
      const parsed = JSON.parse(consoleSpy.mock.calls[0]![0] as string);
      expect(parsed).toEqual({ key: 'value' });
    });
  });
});
