#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { Command } = require('commander');
const YAML = require('yamljs');

function loadEnv(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) {
    return env;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const [key, ...rest] = trimmed.split('=');
    env[key] = rest.join('=').trim();
  }
  return env;
}

function loadServiceConfig(configPath) {
  if (!configPath) {
    return {};
  }
  const fullPath = path.resolve(configPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Service config not found: ${fullPath}`);
  }
  if (fullPath.endsWith('.json')) {
    return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  }
  return YAML.load(fullPath);
}

const program = new Command();
program
  .name('vaultfire-deploy')
  .description('Plan partner-ready Vaultfire deployments')
  .option('-e, --env <mode>', 'Environment mode', 'sandbox')
  .option('-c, --config <file>', 'Path to service manifest', path.join(__dirname, '..', 'configs', 'deployment', 'telemetry.yaml'))
  .option('--dry-run', 'Only render deployment plan', false)
  .option('--relay-config <file>', 'Webhook relay configuration file')
  .option('--rewards-config <file>', 'Reward stream configuration file')
  .parse(process.argv);

const options = program.opts();

function resolveEnvFile(mode) {
  const baseDir = path.join(__dirname, '..', 'deploy');
  return path.join(baseDir, `.env.${mode}.example`);
}

try {
  const envFile = resolveEnvFile(options.env);
  const envVars = loadEnv(envFile);
  const primaryConfig = loadServiceConfig(options.config);
  const relayConfig = loadServiceConfig(options.relayConfig || path.join(__dirname, '..', 'configs', 'deployment', 'relay.yaml'));
  const rewardConfig = loadServiceConfig(
    options.rewardsConfig || path.join(__dirname, '..', 'configs', 'deployment', 'reward-streams.yaml')
  );

  const summary = {
    mode: options.env,
    envFile,
    envSampleKeys: Object.keys(envVars),
    telemetry: primaryConfig,
    relay: relayConfig,
    rewards: rewardConfig,
  };

  if (options.dryRun) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`Preparing Vaultfire deployment for ${options.env}`);
    console.log(`Loaded ${summary.envSampleKeys.length} environment variables from ${envFile}`);
    console.log('Telemetry sink configuration:', summary.telemetry);
    console.log('Relay queue configuration:', summary.relay);
    console.log('Reward stream configuration:', summary.rewards);
    console.log('To execute deployment, provide real credentials via environment variables and rerun with provider scripts.');
  }
} catch (error) {
  console.error('Unable to prepare deployment:', error.message);
  process.exitCode = 1;
}
