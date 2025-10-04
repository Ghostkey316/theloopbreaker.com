#!/usr/bin/env node
const path = require('path');
const { Command } = require('commander');
const chalk = require('chalk');
const TokenService = require('../auth/tokenService');
const {
  initConfig,
  testConnection,
  pushBeliefs,
  loadConfig,
  summarizeMirror,
  verifyTrustSync,
} = require('./actions');
const { registerBeliefVoteCommand } = require('./beliefVote');
const { ROLES } = require('../auth/roles');
const { recordCliEvent } = require('../codex/ledger');
const RewardContractInterface = require('../src/rewards/contractInterface');
const ethics = require('../services/ethicsEngineV2');

const program = new Command();
const tokenService = new TokenService();
const STARTER_CONFIG_PATH = path.join(__dirname, '..', 'configs', 'starter-pilot', 'vaultfire-lite.yaml');
let starterModeInitialized = false;

program
  .name('vaultfire-cli')
  .description('Vaultfire partner activation toolkit')
  .version('1.0.0');

program.option('--starter-mode', 'Load the starter pilot configuration with minimal modules', false);

program.hook('preAction', () => {
  const { starterMode } = program.opts();
  if (starterMode && !starterModeInitialized) {
    process.env.VAULTFIRE_STARTER_MODE = 'true';
    if (!process.env.VAULTFIRE_RC_PATH) {
      process.env.VAULTFIRE_RC_PATH = STARTER_CONFIG_PATH;
    }
    console.log(
      chalk.cyan(
        `Starter pilot configuration enabled via ${path.relative(process.cwd(), STARTER_CONFIG_PATH)}. Advanced modules remain disabled.`,
      ),
    );
    starterModeInitialized = true;
  }
});

program
  .command('init')
  .option('-c, --config <path>', 'Output path for the partner config file')
  .option('--overwrite', 'Overwrite existing configuration file', false)
  .option('--partner <partnerId>', 'Partner identifier to embed in the config')
  .option('--base-url <url>', 'Vaultfire core API URL', 'http://localhost:4002')
  .option('--role <role>', 'Default role for generated tokens', ROLES.PARTNER)
  .option('--wallet <wallet>', 'Default wallet address used for identity')
  .option('--ens <ens>', 'Optional ENS alias for the wallet identity')
  .action((options) => {
    const initialWallet = options.wallet ? options.wallet.toLowerCase() : null;
    const initialEns = options.ens ? options.ens.toLowerCase() : null;
    const context = ethics.reflect({ command: 'init', wallet: initialWallet, ens: initialEns });
    let status = 'success';
    let recordedWallet = initialWallet;
    let recordedEns = initialEns;
    try {
      const { config, path } = initConfig({
        configPath: options.config,
        overwrite: options.overwrite,
        partnerId: options.partner,
        baseUrl: options.baseUrl,
        role: options.role,
        walletAddress: options.wallet,
        ensAlias: options.ens,
      });
      recordedWallet = config.walletAddress;
      recordedEns = config.ensAlias;
      console.log(chalk.green(`Partner configuration created at ${path}`));
      console.log(JSON.stringify(config, null, 2));
    } catch (error) {
      status = 'error';
      console.error(chalk.red(error.message));
      process.exitCode = 1;
    } finally {
      recordCliEvent({ command: 'init', wallet: recordedWallet, ens: recordedEns, status, digest: context.digest });
      ethics.checkpoint({ command: 'init', status, digest: context.digest });
    }
  });

program
  .command('test')
  .option('-c, --config <path>', 'Path to the partner config file')
  .action(async (options) => {
    let status = 'success';
    let config;
    let context;
    try {
      config = loadConfig(options.config);
      context = ethics.reflect({ command: 'test', wallet: config.walletAddress, ens: config.ensAlias });
      const result = await testConnection({ configPath: options.config });
      if (result.ok) {
        console.log(chalk.green(`API reachable at status ${result.status}`));
      } else {
        console.log(chalk.yellow(`API responded with status ${result.status}`));
      }
      console.log(JSON.stringify(result.body, null, 2));
    } catch (error) {
      status = 'error';
      if (!context) {
        context = ethics.reflect({ command: 'test', wallet: config?.walletAddress, ens: config?.ensAlias });
      }
      console.error(chalk.red(`Test failed: ${error.message}`));
      process.exitCode = 1;
    } finally {
      recordCliEvent({
        command: 'test',
        wallet: config?.walletAddress,
        ens: config?.ensAlias,
        status,
        digest: context?.digest,
      });
      ethics.checkpoint({ command: 'test', status, digest: context?.digest });
    }
  });

program
  .command('push')
  .option('-c, --config <path>', 'Path to the partner config file')
  .option('-t, --token <token>', 'Existing JWT to use for authentication')
  .option('--wallet <wallet>', 'Override wallet address for this session')
  .option('--ens <ens>', 'Override ENS alias for this session')
  .option('--beliefproof', 'Generate beliefproof signature', false)
  .action(async (options) => {
    let status = 'success';
    let config;
    let context;
    let proof = null;
    let sessionWallet = options.wallet ? options.wallet.toLowerCase() : null;
    let sessionEns = options.ens !== undefined ? (options.ens ? options.ens.toLowerCase() : null) : null;
    try {
      config = loadConfig(options.config);
      sessionWallet = (options.wallet || config.walletAddress || '').toLowerCase();
      if (!sessionWallet) {
        throw new Error('Wallet identity is required. Set --wallet or configure walletAddress.');
      }
      sessionEns =
        options.ens !== undefined ? (options.ens ? options.ens.toLowerCase() : null) : config.ensAlias;
      context = ethics.reflect({ command: 'push', wallet: sessionWallet, ens: sessionEns });
      const token =
        options.token ||
        tokenService.createAccessToken({
          wallet: sessionWallet,
          ens: sessionEns,
          role: config.role,
          partnerId: config.partnerId,
          scopes: config.scopes,
        });

      const response = await pushBeliefs({
        configPath: options.config,
        token,
        wallet: sessionWallet,
        ens: sessionEns,
        beliefproof: options.beliefproof,
      });
      proof = response.proof || null;
      const color = response.ok ? chalk.green : chalk.yellow;
      console.log(color(`Push response status: ${response.status}`));
      console.log(JSON.stringify(response.body, null, 2));
      if (proof && options.beliefproof) {
        console.log(chalk.cyan(`Beliefproof hash: ${proof.hash}`));
        console.log(chalk.cyan(`Beliefproof signature: ${proof.signature}`));
      }
    } catch (error) {
      status = 'error';
      if (!context) {
        context = ethics.reflect({ command: 'push', wallet: sessionWallet, ens: sessionEns });
      }
      console.error(chalk.red(`Push failed: ${error.message}`));
      process.exitCode = 1;
    } finally {
      recordCliEvent({
        command: 'push',
        wallet: sessionWallet,
        ens: sessionEns,
        status,
        proof,
        digest: context?.digest,
      });
      ethics.checkpoint({ command: 'push', status, digest: context?.digest, proof: proof?.hash });
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
      const context = ethics.reflect({ command: 'mirror', wallet: null, ens: null });
      console.log(chalk.yellow('No mirror action selected. Use --summarize to generate a summary.'));
      recordCliEvent({ command: 'mirror', wallet: null, ens: null, status: 'skipped', digest: context.digest });
      ethics.checkpoint({ command: 'mirror', status: 'skipped', digest: context.digest });
      return;
    }

    let status = 'success';
    let config;
    let context;
    try {
      config = loadConfig(options.config);
      context = ethics.reflect({ command: 'mirror', wallet: config.walletAddress, ens: config.ensAlias });
      const summary = await summarizeMirror({
        configPath: options.config,
        inputPath: options.input,
        outputChannel: options.channel,
      });
      console.log(chalk.cyan('Mirror summary generated:'));
      console.log(JSON.stringify(summary, null, 2));
    } catch (error) {
      status = 'error';
      if (!context) {
        context = ethics.reflect({ command: 'mirror', wallet: config?.walletAddress, ens: config?.ensAlias });
      }
      console.error(chalk.red(`Mirror command failed: ${error.message}`));
      process.exitCode = 1;
    } finally {
      recordCliEvent({
        command: 'mirror',
        wallet: config?.walletAddress,
        ens: config?.ensAlias,
        status,
        digest: context?.digest,
      });
      ethics.checkpoint({ command: 'mirror', status, digest: context?.digest });
    }
  });

program
  .command('trust-sync')
  .description('Run Trust Sync verification flow')
  .option('-c, --config <path>', 'Path to the partner config file')
  .option('--wallet <wallet>', 'Wallet identity to verify')
  .option('--ens <ens>', 'ENS alias override for verification')
  .option('--history', 'Include full belief sync history in the output', false)
  .action(async (options) => {
    let status = 'success';
    let config;
    let context;
    let result;
    let wallet = options.wallet ? options.wallet.toLowerCase() : null;
    let ens = options.ens !== undefined ? (options.ens ? options.ens.toLowerCase() : null) : null;
    try {
      config = loadConfig(options.config);
      wallet = (options.wallet || config.walletAddress || '').toLowerCase();
      if (!wallet) {
        throw new Error('Wallet identity is required for Trust Sync verification.');
      }
      ens = options.ens !== undefined ? (options.ens ? options.ens.toLowerCase() : null) : config.ensAlias;
      context = ethics.reflect({ command: 'trust-sync', wallet, ens });
      result = await verifyTrustSync({
        configPath: options.config,
        wallet,
        ens,
        includeHistory: options.history,
      });
      console.log(chalk.green('Trust Sync verification complete.'));
      if (Array.isArray(result.warnings) && result.warnings.length) {
        result.warnings.forEach((warning) => {
          console.warn(chalk.yellow(`Warning: ${warning}`));
        });
      }
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      status = 'error';
      if (!context) {
        context = ethics.reflect({ command: 'trust-sync', wallet, ens });
      }
      console.error(chalk.red(`Trust Sync verification failed: ${error.message}`));
      process.exitCode = 1;
    } finally {
      recordCliEvent({
        command: 'trust-sync',
        wallet: result?.wallet || wallet,
        ens: result?.ensAlias ?? ens,
        status,
        digest: context?.digest,
      });
      ethics.checkpoint({ command: 'trust-sync', status, digest: context?.digest });
    }
  });

program
  .command('trigger-reward')
  .description('Trigger an on-chain Vaultfire reward stream for a contributor wallet')
  .argument('<userId>', 'Vaultfire user identifier')
  .requiredOption('--wallet <address>', 'Recipient wallet address')
  .option('--ens <ens>', 'Optional ENS alias for the recipient')
  .option('--multiplier <value>', 'Reward multiplier to encode', '1')
  .option('--duration <seconds>', 'Stream duration in seconds', '604800')
  .option('--metadata <uri>', 'Metadata URI override for the minted NFT')
  .option('--rpc <url>', 'RPC endpoint', process.env.VF_REWARD_RPC_URL)
  .option('--contract <address>', 'Deployed VaultfireStreamNFT contract address', process.env.VF_REWARD_CONTRACT)
  .option('--private-key <key>', 'Private key that holds the STREAM_MANAGER_ROLE', process.env.VF_REWARD_PRIVATE_KEY)
  .option('--simulate', 'Skip on-chain execution and emit a compliance log only', false)
  .action(async (userId, options) => {
    const wallet = (options.wallet || '').toLowerCase();
    const ensAlias = options.ens ? options.ens.toLowerCase() : null;
    const context = ethics.reflect({ command: 'trigger-reward', wallet, ens: ensAlias });
    let status = 'success';
    let attestationDigest = context?.digest || null;

    try {
      const multiplier = Number(options.multiplier);
      if (!Number.isFinite(multiplier) || multiplier <= 0) {
        throw new Error('Multiplier must be a positive number');
      }
      const durationSeconds = Number(options.duration);
      if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
        throw new Error('Duration must be greater than zero seconds');
      }

      const contractInterface = new RewardContractInterface({
        providerUrl: options.rpc,
        contractAddress: options.contract,
        privateKey: options.privateKey,
        defaultDurationSeconds: durationSeconds,
      });

      const result = await contractInterface.triggerRewardStream({
        wallet,
        userId,
        multiplier,
        durationSeconds,
        metadataURI: options.metadata || null,
        simulate: options.simulate,
      });

      attestationDigest = result.digest || attestationDigest;
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      status = 'error';
      console.error(chalk.red(`Failed to trigger reward stream: ${error.message}`));
      process.exitCode = 1;
    } finally {
      recordCliEvent({
        command: 'trigger-reward',
        wallet,
        ens: ensAlias,
        status,
        digest: attestationDigest,
      });
      ethics.checkpoint({ command: 'trigger-reward', status, digest: attestationDigest });
    }
  });

registerBeliefVoteCommand(program);

program.parseAsync(process.argv);
