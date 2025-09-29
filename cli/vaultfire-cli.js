#!/usr/bin/env node
const { Command } = require('commander');
const chalk = require('chalk');
const TokenService = require('../auth/tokenService');
const { initConfig, testConnection, pushBeliefs, loadConfig, summarizeMirror } = require('./actions');
const { ROLES } = require('../auth/roles');

const program = new Command();
const tokenService = new TokenService();

program
  .name('vaultfire-cli')
  .description('Vaultfire partner activation toolkit')
  .version('1.0.0');

program
  .command('init')
  .option('-c, --config <path>', 'Output path for the partner config file')
  .option('--overwrite', 'Overwrite existing configuration file', false)
  .option('--partner <partnerId>', 'Partner identifier to embed in the config')
  .option('--base-url <url>', 'Vaultfire core API URL', 'http://localhost:4002')
  .option('--role <role>', 'Default role for generated tokens', ROLES.PARTNER)
  .action((options) => {
    try {
      const { config, path } = initConfig({
        configPath: options.config,
        overwrite: options.overwrite,
        partnerId: options.partner,
        baseUrl: options.baseUrl,
        role: options.role,
      });
      console.log(chalk.green(`Partner configuration created at ${path}`));
      console.log(JSON.stringify(config, null, 2));
    } catch (error) {
      console.error(chalk.red(error.message));
      process.exitCode = 1;
    }
  });

program
  .command('test')
  .option('-c, --config <path>', 'Path to the partner config file')
  .action(async (options) => {
    try {
      const result = await testConnection({ configPath: options.config });
      if (result.ok) {
        console.log(chalk.green(`API reachable at status ${result.status}`));
      } else {
        console.log(chalk.yellow(`API responded with status ${result.status}`));
      }
      console.log(JSON.stringify(result.body, null, 2));
    } catch (error) {
      console.error(chalk.red(`Test failed: ${error.message}`));
      process.exitCode = 1;
    }
  });

program
  .command('push')
  .option('-c, --config <path>', 'Path to the partner config file')
  .option('-t, --token <token>', 'Existing JWT to use for authentication')
  .action(async (options) => {
    try {
      const config = loadConfig(options.config);
      const token =
        options.token ||
        tokenService.createAccessToken({
          userId: `${config.partnerId}-cli`,
          role: config.role,
          partnerId: config.partnerId,
          scopes: config.scopes,
        });

      const response = await pushBeliefs({ configPath: options.config, token });
      const color = response.ok ? chalk.green : chalk.yellow;
      console.log(color(`Push response status: ${response.status}`));
      console.log(JSON.stringify(response.body, null, 2));
    } catch (error) {
      console.error(chalk.red(`Push failed: ${error.message}`));
      process.exitCode = 1;
    }
  });

program
  .command('mirror')
  .description('Interact with the AI mirror agent')
  .option('-c, --config <path>', 'Path to the partner config file')
  .option('--summarize', 'Summarize the latest belief payload', false)
  .option('--input <path>', 'Override the belief payload file path')
  .option('--channel <channel>', 'Output channel (cli|slack)', 'cli')
  .action(async (options) => {
    if (!options.summarize) {
      console.log(chalk.yellow('No mirror action selected. Use --summarize to generate a summary.'));
      return;
    }

    try {
      const summary = await summarizeMirror({
        configPath: options.config,
        inputPath: options.input,
        outputChannel: options.channel,
      });
      console.log(chalk.cyan('Mirror summary generated:'));
      console.log(JSON.stringify(summary, null, 2));
    } catch (error) {
      console.error(chalk.red(`Mirror command failed: ${error.message}`));
      process.exitCode = 1;
    }
  });

program.parseAsync(process.argv);
