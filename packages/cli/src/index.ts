import { Command } from 'commander';
import { registerSourceCommands } from './commands/source.js';
import { registerAuthCommands, loginFlow } from './commands/auth.js';
import { registerScanCommand } from './commands/scan.js';
import { registerPushCommand } from './commands/push.js';
import { registerInstallCommand, registerUpdateCommand } from './commands/install.js';
import { registerSearchCommand } from './commands/search.js';
import { registerInitCommand } from './commands/init.js';
import { createOutput } from './lib/output.js';

const program = new Command();

program
  .name('skillr')
  .description('AI Agent Skill Registry - discover, install and manage skills')
  .version('0.1.0')
  .option('--json', 'Output in JSON format');

// Top-level `skillr login <url>` shortcut (most common first-time command)
program
  .command('login')
  .description('Login to a Skillr server (shortcut for `skillr auth login`)')
  .argument('[endpoint]', 'Server URL (e.g., https://skillr.company.com)')
  .action(async (endpoint?: string) => {
    const output = createOutput({ json: program.opts().json });
    await loginFlow(endpoint, output);
  });

registerSourceCommands(program);
registerAuthCommands(program);
registerScanCommand(program);
registerPushCommand(program);
registerInstallCommand(program);
registerUpdateCommand(program);
registerSearchCommand(program);
registerInitCommand(program);

program.parse();
