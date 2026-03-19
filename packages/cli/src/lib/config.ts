import { homedir } from 'os';
import { join } from 'path';
import { readFile, writeFile, mkdir, rename } from 'fs/promises';
import { randomBytes } from 'crypto';
import {
  CONFIG_DIR_NAME,
  CONFIG_FILE_NAME,
  DEFAULT_SOURCE_NAME,
  DEFAULT_SOURCE_URL,
  ENV_TOKEN_KEY,
  ENV_CONFIG_DIR_KEY,
} from '@skillr/shared';
import type { SkillrConfig, SourceConfig } from '@skillr/shared';

export function getConfigDir(overrideDir?: string): string {
  if (overrideDir) return overrideDir;
  const envDir = process.env[ENV_CONFIG_DIR_KEY];
  if (envDir) return envDir;
  return join(homedir(), CONFIG_DIR_NAME);
}

export function getConfigPath(configDir?: string): string {
  return join(getConfigDir(configDir), CONFIG_FILE_NAME);
}

export function getDefaultConfig(): SkillrConfig {
  return {
    sources: [],  // Empty — user must add a source via `skillr login` or `skillr source add`
    auth: {},
    telemetry: true,
  };
}

export async function loadConfig(configDir?: string): Promise<SkillrConfig> {
  const configPath = getConfigPath(configDir);
  try {
    const content = await readFile(configPath, 'utf-8');
    return JSON.parse(content) as SkillrConfig;
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'ENOENT') {
      return getDefaultConfig();
    }
    process.stderr.write(`Warning: Failed to parse config file, using defaults.\n`);
    return getDefaultConfig();
  }
}

export async function saveConfig(config: SkillrConfig, configDir?: string): Promise<void> {
  const dir = getConfigDir(configDir);
  await mkdir(dir, { recursive: true });
  const configPath = getConfigPath(configDir);
  const tmpPath = `${configPath}.${randomBytes(4).toString('hex')}.tmp`;
  await writeFile(tmpPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  await rename(tmpPath, configPath);
}

export function getDefaultSource(config: SkillrConfig): SourceConfig | undefined {
  const defaultSource = config.sources.find((s) => s.default);
  if (defaultSource) return defaultSource;
  return config.sources[0];
}

export function getAuthToken(sourceUrl: string, config?: SkillrConfig): string | undefined {
  const envToken = process.env[ENV_TOKEN_KEY];
  if (envToken) return envToken;
  if (!config) return undefined;
  return config.auth[sourceUrl]?.token;
}
