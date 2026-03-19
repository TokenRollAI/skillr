import { existsSync, mkdirSync, symlinkSync, unlinkSync, readlinkSync } from 'fs';
import { join } from 'path';

export type AgentEnv = 'claude' | 'codex' | null;

export function detectAgentEnv(dir: string): AgentEnv {
  if (existsSync(join(dir, '.claude'))) return 'claude';
  if (existsSync(join(dir, '.agents'))) return 'codex';
  return null;
}

export function getSymlinkTarget(dir: string, env: AgentEnv, namespace: string, skillName: string): string | null {
  if (!env) return null;

  if (env === 'claude') {
    return join(dir, '.claude', 'skills', namespace, skillName);
  }
  if (env === 'codex') {
    return join(dir, '.agents', 'skills', namespace, skillName);
  }
  return null;
}

export function createSkillSymlink(cachePath: string, symlinkPath: string): void {
  // Create parent directories
  const parentDir = join(symlinkPath, '..');
  mkdirSync(parentDir, { recursive: true });

  // Remove existing symlink if present
  try {
    const existing = readlinkSync(symlinkPath);
    if (existing === cachePath) return; // Already correct
    unlinkSync(symlinkPath);
  } catch {
    // Not a symlink or doesn't exist
  }

  symlinkSync(cachePath, symlinkPath);
}

export function removeSkillSymlink(symlinkPath: string): boolean {
  try {
    unlinkSync(symlinkPath);
    return true;
  } catch {
    return false;
  }
}
