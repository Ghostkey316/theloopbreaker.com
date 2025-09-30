#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { Command } = require('commander');
const YAML = require('yamljs');

const ROOT_DIR = path.join(__dirname, '..');

function loadJson(filePath, fallback = {}) {
  try {
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
      return fallback;
    }
    return JSON.parse(fs.readFileSync(resolved, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to parse JSON file ${filePath}: ${error.message}`);
  }
}

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
  .option('-c, --config <file>', 'Path to service manifest', path.join(ROOT_DIR, 'configs', 'deployment', 'telemetry.yaml'))
  .option('--dry-run', 'Only render deployment plan', false)
  .option('--relay-config <file>', 'Webhook relay configuration file')
  .option('--rewards-config <file>', 'Reward stream configuration file')
  .option('--handshake-config <file>', 'Handshake configuration file', path.join(ROOT_DIR, 'configs', 'deployment', 'handshake.yaml'))
  .parse(process.argv);

const options = program.opts();

function resolveEnvFile(mode) {
  const baseDir = path.join(ROOT_DIR, 'deploy');
  return path.join(baseDir, `.env.${mode}.example`);
}

function evaluateEthicsConfig(handshakeConfig) {
  const ethics = handshakeConfig?.services?.handshake?.attestation || {};
  return {
    pluginId: ethics.pluginId || null,
    manifestPath: ethics.manifestPath || null,
    required: Boolean(ethics.required),
  };
}

function evaluateBeliefMetrics(handshakeConfig) {
  const metrics = handshakeConfig?.services?.handshake?.beliefComplexity?.metrics || [];
  return metrics.map((metric) => ({
    id: metric.id,
    capture: metric.capture,
  }));
}

function summarizeBehaviorMetrics(handshakeConfig, rewardConfig) {
  const handshake = handshakeConfig?.services?.handshake?.beliefComplexity || {};
  const rewards = rewardConfig?.services?.['reward-streams']?.behaviorMetrics || {};
  return {
    handshake: {
      telemetryChannel: handshake.telemetryChannel || null,
      logging: {
        enabled: Boolean(handshake.logging?.enabled),
        stream: handshake.logging?.stream || null,
        persistTo: handshake.logging?.persistTo || null,
      },
      trackedMetrics: (handshake.metrics || []).map((metric) => metric.id),
    },
    rewards: {
      telemetryChannel: rewards.telemetryChannel || null,
      logStream: rewards.logComplexityStream || null,
      flushIntervalSeconds: rewards.flushIntervalSeconds || null,
      capture: rewards.capture || {},
    },
  };
}

function summarizeSandboxModes(handshakeConfig, rewardConfig) {
  const handshakeSandbox = handshakeConfig?.services?.handshake?.sandbox || {};
  const rewardSandbox = rewardConfig?.services?.['reward-streams']?.sandboxMode || {};
  return {
    handshake: {
      enabled: Boolean(handshakeSandbox.enabled),
      allowedPartners: handshakeSandbox.allowedPartners || [],
      behaviorAudit: handshakeSandbox.behaviorAudit || null,
      loyaltyPreview: handshakeSandbox.loyaltyPreview || null,
    },
    rewards: {
      enabled: Boolean(rewardSandbox.enabled),
      cohortTag: rewardSandbox.cohortTag || null,
      loyaltyPreviewCap: rewardSandbox.loyaltyPreviewCap || null,
      touchpointSpacingSeconds: rewardSandbox.touchpointSpacingSeconds || null,
    },
  };
}

function extractReleaseTrain(config) {
  return config?.metadata?.releaseTrain || null;
}

function computeChangelogStatus(entries) {
  if (!Array.isArray(entries)) {
    return { finalized: null, pending: [] };
  }
  const pending = entries.filter((entry) => entry.update_block !== 'FINALIZED');
  const finalized = [...entries]
    .reverse()
    .find((entry) => entry.update_block === 'FINALIZED');
  return {
    finalized,
    pending,
  };
}

try {
  const envFile = resolveEnvFile(options.env);
  const envVars = loadEnv(envFile);
  const primaryConfig = loadServiceConfig(options.config);
  const relayConfig = loadServiceConfig(options.relayConfig || path.join(ROOT_DIR, 'configs', 'deployment', 'relay.yaml'));
  const rewardConfig = loadServiceConfig(
    options.rewardsConfig || path.join(ROOT_DIR, 'configs', 'deployment', 'reward-streams.yaml')
  );
  const handshakeConfig = loadServiceConfig(options.handshakeConfig);
  const manifest = loadJson(path.join(ROOT_DIR, 'codex_manifest.json'));
  const packageJson = loadJson(path.join(ROOT_DIR, 'package.json'));
  const changelogEntries = loadJson(path.join(ROOT_DIR, 'changelog.json'), []);
  const changelogStatus = computeChangelogStatus(changelogEntries);

  const summary = {
    mode: options.env,
    envFile,
    envSampleKeys: Object.keys(envVars),
    telemetry: primaryConfig,
    relay: relayConfig,
    rewards: rewardConfig,
    handshake: handshakeConfig,
    ethics: evaluateEthicsConfig(handshakeConfig),
    beliefMetrics: evaluateBeliefMetrics(handshakeConfig),
    behaviorMetricsLog: summarizeBehaviorMetrics(handshakeConfig, rewardConfig),
    sandboxReadiness: summarizeSandboxModes(handshakeConfig, rewardConfig),
    manifestIntegrity: {
      status: manifest?.integrity_checks?.status || 'UNKNOWN',
      checksum: manifest?.checksum || null,
    },
    versioning: {
      packageVersion: packageJson.version,
      finalizedChangelog: changelogStatus.finalized,
      pendingChangelog: changelogStatus.pending.map((entry) => entry.change),
    },
    releaseTrain: {
      telemetry: extractReleaseTrain(primaryConfig),
      relay: extractReleaseTrain(relayConfig),
      rewards: extractReleaseTrain(rewardConfig),
      handshake: extractReleaseTrain(handshakeConfig),
    },
  };

  if (options.dryRun) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`Preparing Vaultfire deployment for ${options.env}`);
    console.log(`Loaded ${summary.envSampleKeys.length} environment variables from ${envFile}`);
    console.log('Telemetry sink configuration:', summary.telemetry);
    console.log('Relay queue configuration:', summary.relay);
    console.log('Reward stream configuration:', summary.rewards);
    console.log('Handshake configuration:', summary.handshake);
    console.log('Ethics attestation policy:', summary.ethics);
    console.log('Belief complexity metrics:', summary.beliefMetrics);
    console.log('Behavior metrics logging:', summary.behaviorMetricsLog);
    console.log('Sandbox readiness:', summary.sandboxReadiness);
    console.log('Manifest integrity status:', summary.manifestIntegrity);
    console.log('Versioning + changelog status:', summary.versioning);
    console.log('Release train alignment:', summary.releaseTrain);
    console.log('To execute deployment, provide real credentials via environment variables and rerun with provider scripts.');
  }
} catch (error) {
  console.error('Unable to prepare deployment:', error.message);
  process.exitCode = 1;
}
