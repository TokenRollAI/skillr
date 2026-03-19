import type { Command } from 'commander';
import type { SkillrConfig, SourceConfig } from '@skillr/shared';
import { loadConfig, saveConfig, getConfigDir } from '../lib/config.js';
import { createOutput, type OutputAdapter } from '../lib/output.js';

export function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function listSources(
  output: OutputAdapter,
  configDir?: string,
): Promise<SourceConfig[]> {
  const config = await loadConfig(configDir);
  const sources = config.sources;

  output.table(
    ['Name', 'URL', 'Default'],
    sources.map((s) => [s.name, s.url, s.default ? '✔' : '']),
  );

  return sources;
}

export async function addSource(
  name: string,
  url: string,
  output: OutputAdapter,
  configDir?: string,
): Promise<void> {
  if (!isValidUrl(url)) {
    output.error(`Invalid URL: ${url}. Must be a valid http/https URL.`);
    process.exitCode = 1;
    return;
  }

  const config = await loadConfig(configDir);

  if (config.sources.some((s) => s.name === name)) {
    output.error(`Source "${name}" already exists.`);
    process.exitCode = 1;
    return;
  }

  if (config.sources.some((s) => s.url === url)) {
    output.error(`A source with URL "${url}" already exists.`);
    process.exitCode = 1;
    return;
  }

  config.sources.push({ name, url });
  await saveConfig(config, configDir);
  output.success(`Source "${name}" (${url}) added successfully.`);
}

export async function removeSource(
  name: string,
  output: OutputAdapter,
  configDir?: string,
): Promise<void> {
  const config = await loadConfig(configDir);
  const idx = config.sources.findIndex((s) => s.name === name);

  if (idx === -1) {
    output.error(`Source "${name}" not found.`);
    process.exitCode = 1;
    return;
  }

  if (config.sources.length <= 1) {
    output.error('Cannot remove the last source. At least one source must remain.');
    process.exitCode = 1;
    return;
  }

  const wasDefault = config.sources[idx]!.default;
  config.sources.splice(idx, 1);

  if (wasDefault && config.sources.length > 0) {
    config.sources[0]!.default = true;
  }

  await saveConfig(config, configDir);
  output.success(`Source "${name}" removed successfully.`);
}

export async function setDefaultSource(
  name: string,
  output: OutputAdapter,
  configDir?: string,
): Promise<void> {
  const config = await loadConfig(configDir);
  const source = config.sources.find((s) => s.name === name);

  if (!source) {
    output.error(`Source "${name}" not found.`);
    process.exitCode = 1;
    return;
  }

  for (const s of config.sources) {
    s.default = s.name === name;
  }

  await saveConfig(config, configDir);
  output.success(`Default source set to "${name}".`);
}

export function registerSourceCommands(program: Command): void {
  const source = program.command('source').description('Manage skill registry sources');

  source
    .command('list')
    .description('List all configured sources')
    .action(async () => {
      const output = createOutput({ json: program.opts().json });
      await listSources(output);
    });

  source
    .command('add')
    .description('Add a new source')
    .argument('<name>', 'Source name')
    .argument('<url>', 'Source URL')
    .action(async (name: string, url: string) => {
      const output = createOutput({ json: program.opts().json });
      await addSource(name, url, output);
    });

  source
    .command('remove')
    .description('Remove a source')
    .argument('<name>', 'Source name to remove')
    .action(async (name: string) => {
      const output = createOutput({ json: program.opts().json });
      await removeSource(name, output);
    });

  source
    .command('set-default')
    .description('Set the default source')
    .argument('<name>', 'Source name to set as default')
    .action(async (name: string) => {
      const output = createOutput({ json: program.opts().json });
      await setDefaultSource(name, output);
    });
}
