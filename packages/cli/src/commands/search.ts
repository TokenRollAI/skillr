import { Command } from 'commander';
import { loadConfig, getDefaultSource, getAuthToken } from '../lib/config.js';
import { RegistryClient } from '../lib/registry-client.js';
import { createOutput, type OutputAdapter } from '../lib/output.js';

export async function searchSkills(
  query: string,
  namespace: string | undefined,
  limit: number,
  output: OutputAdapter,
  configDir?: string,
): Promise<void> {
  const config = await loadConfig(configDir);
  const source = getDefaultSource(config);
  if (!source) {
    output.error('No source configured.');
    process.exitCode = 1;
    return;
  }

  const token = getAuthToken(source.url, config);
  const client = new RegistryClient(source.url, token);

  try {
    const results = await client.searchSkills(query, namespace, limit);
    if (results.length === 0) {
      output.info('No skills found.');
      return;
    }

    output.table(
      ['Skill', 'Description', 'Install Command'],
      results.map((r: any) => [
        `${r.namespace}/${r.name}`,
        (r.description || '').slice(0, 40),
        `skillr install ${r.namespace}/${r.name}`,
      ]),
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    output.error(`Search failed: ${message}`);
    process.exitCode = 1;
  }
}

export function registerSearchCommand(program: Command): void {
  program
    .command('search')
    .description('Search for skills')
    .argument('<query>', 'Search query')
    .option('-n, --namespace <namespace>', 'Filter by namespace')
    .option('-l, --limit <limit>', 'Max results', '20')
    .action(async (query: string, opts: { namespace?: string; limit: string }) => {
      const output = createOutput({ json: program.opts().json });
      await searchSkills(query, opts.namespace, parseInt(opts.limit), output);
    });
}
