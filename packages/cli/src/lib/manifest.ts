import { readFile } from 'fs/promises';
import { join } from 'path';
import type { SkillManifest } from '@skillr/shared';

const NS_REGEX = /^@[a-z0-9][a-z0-9-]*$/;

export async function loadManifest(dir: string): Promise<SkillManifest | null> {
  const path = join(dir, 'skill.json');
  let content: string;
  try {
    content = await readFile(path, 'utf-8');
  } catch {
    return null;
  }

  let manifest: SkillManifest;
  try {
    manifest = JSON.parse(content);
  } catch {
    throw new Error('skill.json: invalid JSON format');
  }

  if (!manifest.name) {
    throw new Error('skill.json: "name" is required');
  }

  if (manifest.namespace && !NS_REGEX.test(manifest.namespace)) {
    throw new Error(`skill.json: invalid namespace "${manifest.namespace}" — must match ${NS_REGEX}`);
  }

  if (!manifest.skills && !manifest.description) {
    throw new Error('skill.json: "description" is required in single-skill mode');
  }

  if (manifest.skills) {
    for (const entry of manifest.skills) {
      if (!entry.path) throw new Error('skill.json: skill entry missing "path"');
      if (!entry.name) throw new Error(`skill.json: skill entry at "${entry.path}" missing "name"`);
      if (!entry.description) throw new Error(`skill.json: skill entry at "${entry.path}" missing "description"`);
    }
  }

  return manifest;
}
