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
  sourceName: string | undefined,
  output: OutputAdapter,
  configDir?: string,
  sleepFn: (ms: number) => Promise<void> = sleep,
): Promise<void> {
  const config = await loadConfig(configDir);

  let source;
  if (sourceName) {
    source = config.sources.find((s) => s.name === sourceName);
    if (!source) {
      output.error(`Source "${sourceName}" not found.`);
      process.exitCode = 1;
      return;
    }
  } else {
    source = getDefaultSource(config);
    if (!source) {
      output.error('No sources configured. Add a source first with `skillr source add`.');
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

export async function logout(
  sourceName: string | undefined,
  output: OutputAdapter,
  configDir?: string,
): Promise<void> {
  const config = await loadConfig(configDir);

  let source;
  if (sourceName) {
    source = config.sources.find((s) => s.name === sourceName);
    if (!source) {
      output.error(`Source "${sourceName}" not found.`);
      process.exitCode = 1;
      return;
    }
  } else {
    source = getDefaultSource(config);
    if (!source) {
      output.error('No sources configured.');
      process.exitCode = 1;
      return;
    }
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
  sourceName: string | undefined,
  output: OutputAdapter,
  configDir?: string,
): Promise<void> {
  const config = await loadConfig(configDir);

  let source;
  if (sourceName) {
    source = config.sources.find((s) => s.name === sourceName);
    if (!source) {
      output.error(`Source "${sourceName}" not found.`);
      process.exitCode = 1;
      return;
    }
  } else {
    source = getDefaultSource(config);
    if (!source) {
      output.error('No sources configured.');
      process.exitCode = 1;
      return;
    }
  }

  const token = getAuthToken(source.url, config);
  if (!token) {
    output.error('Not logged in. Run `skillr auth login` first.');
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
    .description('Login to a skill registry (Device Code flow)')
    .option('-s, --source <name>', 'Source name to authenticate with')
    .action(async (opts: { source?: string }) => {
      const output = createOutput({ json: program.opts().json });
      await loginFlow(opts.source, output);
    });

  auth
    .command('logout')
    .description('Logout from a skill registry')
    .option('-s, --source <name>', 'Source name to logout from')
    .action(async (opts: { source?: string }) => {
      const output = createOutput({ json: program.opts().json });
      await logout(opts.source, output);
    });

  auth
    .command('whoami')
    .description('Show current authenticated user')
    .option('-s, --source <name>', 'Source name')
    .action(async (opts: { source?: string }) => {
      const output = createOutput({ json: program.opts().json });
      await whoami(opts.source, output);
    });

  auth
    .command('status')
    .description('Show authentication status for all sources')
    .action(async () => {
      const output = createOutput({ json: program.opts().json });
      await authStatus(output);
    });
}
