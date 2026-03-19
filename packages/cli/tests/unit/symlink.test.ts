import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, readlink } from 'fs/promises';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { detectAgentEnv, getSymlinkTarget, createSkillSymlink, removeSkillSymlink } from '../../src/lib/symlink.js';

describe('symlink', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'skillhub-symlink-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('detectAgentEnv', () => {
    it('should detect claude env', async () => {
      await mkdir(join(tempDir, '.claude'));
      expect(detectAgentEnv(tempDir)).toBe('claude');
    });

    it('should detect codex env', async () => {
      await mkdir(join(tempDir, '.agents'));
      expect(detectAgentEnv(tempDir)).toBe('codex');
    });

    it('should return null when no env detected', () => {
      expect(detectAgentEnv(tempDir)).toBeNull();
    });
  });

  describe('getSymlinkTarget', () => {
    it('should return correct claude skills path', () => {
      const target = getSymlinkTarget(tempDir, 'claude', '@test', 'my-skill');
      expect(target).toBe(join(tempDir, '.claude', 'skills', '@test', 'my-skill'));
    });

    it('should return correct codex skills path', () => {
      const target = getSymlinkTarget(tempDir, 'codex', '@test', 'my-skill');
      expect(target).toBe(join(tempDir, '.agents', 'skills', '@test', 'my-skill'));
    });

    it('should return null for no env', () => {
      expect(getSymlinkTarget(tempDir, null, '@test', 'my-skill')).toBeNull();
    });
  });

  describe('createSkillSymlink', () => {
    it('should create a symlink', async () => {
      const cachePath = join(tempDir, 'cache', 'skill');
      const symlinkPath = join(tempDir, 'link', 'skill');
      await mkdir(cachePath, { recursive: true });

      createSkillSymlink(cachePath, symlinkPath);

      expect(existsSync(symlinkPath)).toBe(true);
      const target = await readlink(symlinkPath);
      expect(target).toBe(cachePath);
    });
  });

  describe('removeSkillSymlink', () => {
    it('should remove an existing symlink', async () => {
      const cachePath = join(tempDir, 'cache', 'skill');
      const symlinkPath = join(tempDir, 'link', 'skill');
      await mkdir(cachePath, { recursive: true });
      createSkillSymlink(cachePath, symlinkPath);

      const result = removeSkillSymlink(symlinkPath);
      expect(result).toBe(true);
      expect(existsSync(symlinkPath)).toBe(false);
    });

    it('should return false for non-existent symlink', () => {
      expect(removeSkillSymlink(join(tempDir, 'nonexistent'))).toBe(false);
    });
  });
});
