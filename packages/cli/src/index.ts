import { Command } from 'commander';
import { registerSourceCommands } from './commands/source.js';
import { registerAuthCommands } from './commands/auth.js';
import { registerScanCommand } from './commands/scan.js';
import { registerPushCommand } from './commands/push.js';
import { registerInstallCommand, registerUpdateCommand } from './commands/install.js';
import { registerSearchCommand } from './commands/search.js';

const program = new Command();

program
  .name('skillr')
  .description('AI Agent Skill Registry - discover, install and manage skills')
  .version('0.1.0')
  .option('--json', '以 JSON 格式输出');

registerSourceCommands(program);
registerAuthCommands(program);
registerScanCommand(program);
registerPushCommand(program);
registerInstallCommand(program);
registerUpdateCommand(program);
registerSearchCommand(program);

program.parse();
