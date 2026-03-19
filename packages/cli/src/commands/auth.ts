import type { Command } from 'commander';
import type { SkillrConfig } from '@skillr/shared';
import { ENV_TOKEN_KEY } from '@skillr/shared';
import { loadConfig, saveConfig, getDefaultSource, getAuthToken } from '../lib/config.js';
import { createOutput, type OutputAdapter } from '../lib/output.js';
import { RegistryClient } from '../lib/registry-client.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function loginFlow(
  endpointOrSource: string | undefined,
  output: OutputAdapter,
  configDir?: string,
  sleepFn: (ms: number) => Promise<void> = sleep,
): Promise<void> {
  const config = await loadConfig(configDir);

  let source;

  if (endpointOrSource && (endpointOrSource.startsWith('http://') || endpointOrSource.startsWith('https://'))) {
    // User provided a URL — auto-add as a source if not already configured
    const url = endpointOrSource.replace(/\/+$/, '');
    source = config.sources.find((s) => s.url === url);
    if (!source) {
      // Derive a short name from the URL hostname
      const hostname = new URL(url).hostname.replace(/\./g, '-');
      const name = config.sources.length === 0 ? 'default' : hostname;
      source = { name, url, default: config.sources.length === 0 };
      config.sources.push(source);
      await saveConfig(config, configDir);
      output.info(`Added source "${name}" → ${url}`);
    }
  } else if (endpointOrSource) {
    // User provided a source name
    source = config.sources.find((s) => s.name === endpointOrSource);
    if (!source) {
      output.error(`Source "${endpointOrSource}" not found. Use a URL or an existing source name.`);
      output.info('Usage: skillr login https://your-skillr-server.com');
      process.exitCode = 1;
      return;
    }
  } else {
    // No argument — use default source
    source = getDefaultSource(config);
    if (!source) {
      output.error('No sources configured yet.');
      output.info('');
      output.info('To get started, login with your Skillr server URL:');
      output.info('  skillr login https://your-skillr-server.com');
      output.info('');
      output.info('For local development:');
      output.info('  skillr login http://localhost:3001');
      process.exitCode = 1;
      return;
    }
  }

  if (config.auth[source.url]) {
    output.warn(`Already logged in to "${source.name}" (${source.url}). Re-authenticating...`);
  }

  const client = new RegistryClient(source.url);

  let deviceCodeResponse;
  try {
    deviceCodeResponse = await client.requestDeviceCode();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    output.error(`Failed to connect to ${source.url}: ${message}`);
    process.exitCode = 1;
    return;
  }

  const { device_code, user_code, verification_uri, expires_in, interval } = deviceCodeResponse;

  output.info(`Please open the following URL in your browser:`);
  output.info(`  ${verification_uri}`);
  output.info(``);
  output.info(`And enter the verification code:`);
  output.success(`  ${user_code}`);
  output.info(``);
  output.info(`Waiting for authentication...`);

  let pollInterval = (interval || 5) * 1000;
  const deadline = Date.now() + expires_in * 1000;

  while (Date.now() < deadline) {
    await sleepFn(pollInterval);

    try {
      const tokenResponse = await client.pollDeviceToken(device_code);

      if (tokenResponse.error === 'authorization_pending') {
        continue;
      }

      if (tokenResponse.error === 'slow_down') {
        pollInterval += 5000;
        continue;
      }

      if (tokenResponse.error === 'expired_token') {
        output.error('Authentication timed out. Please try again.');
        process.exitCode = 1;
        return;
      }

      if (tokenResponse.error === 'access_denied') {
        output.error('Authentication was denied.');
        process.exitCode = 1;
        return;
      }

      if (tokenResponse.access_token) {
        config.auth[source.url] = {
          token: tokenResponse.access_token,
          expires_at: tokenResponse.expires_in
            ? new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString()
            : undefined,
          type: 'device_code',
        };
        await saveConfig(config, configDir);
        output.success(`Successfully logged in to "${source.name}".`);
        return;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      output.error(`Polling error: ${message}`);
      process.exitCode = 1;
      return;
    }
  }

  output.error('Authentication timed out. Please try again.');
  process.exitCode = 1;
}

function resolveSource(
  config: SkillrConfig,
  endpointOrName: string | undefined,
): { source: import('@skillr/shared').SourceConfig | undefined; error?: string } {
  if (endpointOrName && (endpointOrName.startsWith('http://') || endpointOrName.startsWith('https://'))) {
    const url = endpointOrName.replace(/\/+$/, '');
    const source = config.sources.find((s) => s.url === url);
    if (!source) return { source: undefined, error: `No source configured for ${url}. Run \`skillr login ${url}\` first.` };
    return { source };
  }
  if (endpointOrName) {
    const source = config.sources.find((s) => s.name === endpointOrName);
    if (!source) return { source: undefined, error: `Source "${endpointOrName}" not found.` };
    return { source };
  }
  return { source: getDefaultSource(config) };
}

export async function logout(
  endpointOrName: string | undefined,
  output: OutputAdapter,
  configDir?: string,
): Promise<void> {
  const config = await loadConfig(configDir);
  const { source, error } = resolveSource(config, endpointOrName);

  if (error || !source) {
    output.error(error || 'No sources configured.');
    process.exitCode = 1;
    return;
  }

  if (!config.auth[source.url]) {
    output.warn(`Not logged in to "${source.name}".`);
    return;
  }

  delete config.auth[source.url];
  await saveConfig(config, configDir);
  output.success(`Logged out from "${source.name}".`);
}

export async function whoami(
  endpointOrName: string | undefined,
  output: OutputAdapter,
  configDir?: string,
): Promise<void> {
  const config = await loadConfig(configDir);
  const { source, error } = resolveSource(config, endpointOrName);

  if (error || !source) {
    output.error(error || 'No sources configured. Run `skillr login <url>` first.');
    process.exitCode = 1;
    return;
  }

  const token = getAuthToken(source.url, config);
  if (!token) {
    output.error('Not logged in. Run `skillr login` first.');
    process.exitCode = 1;
    return;
  }

  const client = new RegistryClient(source.url, token);

  try {
    const user = await client.getUserInfo();
    output.info(`Logged in to "${source.name}" (${source.url})`);
    output.table(
      ['Field', 'Value'],
      [
        ['Username', user.username],
        ['Email', user.email],
        ['Role', user.role],
      ],
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    output.error(`Failed to get user info: ${message}`);
    process.exitCode = 1;
  }
}

export async function authStatus(
  output: OutputAdapter,
  configDir?: string,
): Promise<void> {
  const config = await loadConfig(configDir);

  const rows = config.sources.map((source) => {
    const auth = config.auth[source.url];
    const envToken = process.env[ENV_TOKEN_KEY];
    let status = 'Not authenticated';
    let expiresAt = '-';

    if (envToken) {
      status = 'Authenticated (env token)';
    } else if (auth) {
      status = 'Authenticated';
      expiresAt = auth.expires_at ?? 'Never';
    }

    return [source.name, source.url, status, expiresAt];
  });

  output.table(['Source', 'URL', 'Status', 'Expires'], rows);
}

export function registerAuthCommands(program: Command): void {
  const auth = program.command('auth').description('Manage authentication');

  auth
    .command('login')
    .description('Login to a skill registry')
    .argument('[endpoint]', 'Server URL (e.g., https://skillr.company.com) or source name')
    .action(async (endpoint?: string) => {
      const output = createOutput({ json: program.opts().json });
      await loginFlow(endpoint, output);
    });

  auth
    .command('logout')
    .description('Logout from a skill registry')
    .argument('[endpoint]', 'Server URL or source name')
    .action(async (endpoint?: string) => {
      const output = createOutput({ json: program.opts().json });
      await logout(endpoint, output);
    });

  auth
    .command('whoami')
    .description('Show current authenticated user')
    .argument('[endpoint]', 'Server URL or source name')
    .action(async (endpoint?: string) => {
      const output = createOutput({ json: program.opts().json });
      await whoami(endpoint, output);
    });

  auth
    .command('status')
    .description('Show authentication status for all sources')
    .action(async () => {
      const output = createOutput({ json: program.opts().json });
      await authStatus(output);
    });
}
