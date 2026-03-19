import { Command } from 'commander';
import { mkdir, writeFile, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { createHash } from 'crypto';
import * as tar from 'tar';
import { loadConfig, getDefaultSource, getAuthToken, getConfigDir } from '../lib/config.js';
import { RegistryClient } from '../lib/registry-client.js';
import { createOutput, type OutputAdapter } from '../lib/output.js';
import { detectAgentEnv, getSymlinkTarget, createSkillSymlink } from '../lib/symlink.js';

interface InstalledSkill {
  namespace: string;
  name: string;
  tag: string;
  checksum: string;
  installedAt: string;
  cachePath: string;
  symlinkPath?: string;
}

interface InstalledRegistry {
  skills: InstalledSkill[];
}

function getInstalledPath(configDir?: string): string {
  return join(getConfigDir(configDir), 'installed.json');
}

async function loadInstalled(configDir?: string): Promise<InstalledRegistry> {
  const path = getInstalledPath(configDir);
  try {
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content);
  } catch {
    return { skills: [] };
  }
}

async function saveInstalled(registry: InstalledRegistry, configDir?: string): Promise<void> {
  const path = getInstalledPath(configDir);
  await writeFile(path, JSON.stringify(registry, null, 2) + '\n');
}

export async function installSkill(
  skillRef: string,
  tag: string,
  output: OutputAdapter,
  configDir?: string,
): Promise<void> {
  let namespace: string;
  let skillName: string;

  // Try full @namespace/name format first
  const fullMatch = skillRef.match(/^(@[a-z0-9][a-z0-9-]*)\/([a-z0-9][a-z0-9._-]*)$/);

  if (fullMatch) {
    namespace = fullMatch[1]!;
    skillName = fullMatch[2]!;
  } else if (/^[a-z0-9][a-z0-9._-]*$/.test(skillRef)) {
    // Short name without namespace - search for it
    const config = await loadConfig(configDir);
    const source = getDefaultSource(config);
    if (!source) {
      output.error('No source configured.');
      process.exitCode = 1;
      return;
    }
    const token = getAuthToken(source.url, config);
    const client = new RegistryClient(source.url, token);

    output.info(`Searching for "${skillRef}"...`);

    let results: any[];
    try {
      results = await client.searchSkills(skillRef);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      output.error(`Search failed: ${message}`);
      process.exitCode = 1;
      return;
    }

    // Filter for exact name match
    const exactMatches = results.filter((r: any) => r.name === skillRef);

    if (exactMatches.length === 1) {
      namespace = exactMatches[0].namespace;
      skillName = exactMatches[0].name;
      output.info(`Found: ${namespace}/${skillName}`);
    } else if (exactMatches.length > 1) {
      output.warn(`Multiple skills found with name "${skillRef}":`);
      output.table(
        ['Full Name', 'Description'],
        exactMatches.map((r: any) => [`${r.namespace}/${r.name}`, r.description || '']),
      );
      output.info(`Please specify the full name: skillr install <namespace>/${skillRef}`);
      process.exitCode = 1;
      return;
    } else if (results.length > 0) {
      output.warn(`No exact match for "${skillRef}". Did you mean:`);
      output.table(
        ['Full Name', 'Description'],
        results.slice(0, 5).map((r: any) => [`${r.namespace}/${r.name}`, r.description || '']),
      );
      process.exitCode = 1;
      return;
    } else {
      output.error(`Skill "${skillRef}" not found.`);
      process.exitCode = 1;
      return;
    }
  } else {
    output.error('Invalid skill reference. Format: @namespace/skill-name or skill-name');
    process.exitCode = 1;
    return;
  }

  const config = await loadConfig(configDir);
  const source = getDefaultSource(config);
  if (!source) {
    output.error('No source configured.');
    process.exitCode = 1;
    return;
  }

  const token = getAuthToken(source.url, config);
  const client = new RegistryClient(source.url, token);

  output.info(`Fetching ${namespace}/${skillName}:${tag}...`);

  // Get tag info with download URL
  let tagInfo;
  try {
    tagInfo = await client.getSkillTag(namespace, skillName, tag);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    output.error(`Failed to fetch skill info: ${message}`);
    process.exitCode = 1;
    return;
  }

  output.info(`Downloading (${(tagInfo.sizeBytes / 1024).toFixed(1)} KB)...`);

  // Download tarball from signed URL
  const res = await fetch(tagInfo.downloadUrl);
  if (!res.ok) {
    output.error(`Download failed: ${res.status}`);
    process.exitCode = 1;
    return;
  }
  const tarball = Buffer.from(await res.arrayBuffer());

  // Verify checksum
  const actualChecksum = createHash('sha256').update(tarball).digest('hex');
  if (actualChecksum !== tagInfo.checksum) {
    output.error(`Checksum mismatch! Expected ${tagInfo.checksum}, got ${actualChecksum}`);
    process.exitCode = 1;
    return;
  }

  // Extract to cache
  const cacheDir = join(getConfigDir(configDir), 'cache', namespace, skillName);
  await rm(cacheDir, { recursive: true, force: true });
  await mkdir(cacheDir, { recursive: true });

  // Write tarball and extract
  const tarballPath = join(cacheDir, '__download.tar.gz');
  await writeFile(tarballPath, tarball);
  await tar.extract({ file: tarballPath, cwd: cacheDir });
  await rm(tarballPath, { force: true });

  output.success(`Extracted to ${cacheDir}`);

  // Symlink
  const agentEnv = detectAgentEnv(process.cwd());
  let symlinkPath: string | undefined;
  if (agentEnv) {
    symlinkPath = getSymlinkTarget(process.cwd(), agentEnv, namespace, skillName) ?? undefined;
    if (symlinkPath) {
      createSkillSymlink(cacheDir, symlinkPath);
      output.success(`Symlinked to ${symlinkPath}`);
    }
  }

  // Record installation
  const installed = await loadInstalled(configDir);
  const existingIdx = installed.skills.findIndex(
    (s) => s.namespace === namespace && s.name === skillName,
  );
  const record: InstalledSkill = {
    namespace: namespace,
    name: skillName,
    tag,
    checksum: actualChecksum,
    installedAt: new Date().toISOString(),
    cachePath: cacheDir,
    symlinkPath,
  };
  if (existingIdx >= 0) {
    installed.skills[existingIdx] = record;
  } else {
    installed.skills.push(record);
  }
  await saveInstalled(installed, configDir);

  output.success(`Installed ${namespace}/${skillName}:${tag}`);
}

export async function updateSkills(
  skillRef: string | undefined,
  output: OutputAdapter,
  configDir?: string,
): Promise<void> {
  const installed = await loadInstalled(configDir);

  if (installed.skills.length === 0) {
    output.info('No skills installed.');
    return;
  }

  const toUpdate = skillRef
    ? installed.skills.filter((s) => `${s.namespace}/${s.name}` === skillRef)
    : installed.skills;

  if (toUpdate.length === 0) {
    output.info(skillRef ? `Skill ${skillRef} is not installed.` : 'No skills to update.');
    return;
  }

  output.info(`Checking ${toUpdate.length} skill(s) for updates...`);

  for (const skill of toUpdate) {
    await installSkill(`${skill.namespace}/${skill.name}`, 'latest', output, configDir);
  }
}

export function registerInstallCommand(program: Command): void {
  program
    .command('install')
    .description('Install a skill from the registry')
    .argument('<ref>', 'Skill reference (@namespace/skill-name or skill-name)')
    .option('-t, --tag <tag>', 'Version tag', 'latest')
    .action(async (ref: string, opts: { tag: string }) => {
      const output = createOutput({ json: program.opts().json });
      await installSkill(ref, opts.tag, output);
    });
}

export function registerUpdateCommand(program: Command): void {
  program
    .command('update')
    .description('Update installed skills to the latest version')
    .argument('[ref]', 'Specific skill to update (@namespace/skill-name)')
    .action(async (ref?: string) => {
      const output = createOutput({ json: program.opts().json });
      await updateSkills(ref, output);
    });
}
