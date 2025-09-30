#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { Command } = require('commander');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const schema = require('../schemas/vaultfirerc.schema.json');

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validateConfigSchema = ajv.compile(schema);

const BASE_TRUST_SYNC = {
  identityStore: {
    provider: 'memory',
    breachThreshold: 0.35,
  },
  telemetry: {
    baseDir: './logs/telemetry',
    fallback: {
      enabled: true,
      fileName: 'remote-fallback.jsonl',
    },
  },
  verification: {
    remote: null,
    externalValidationEndpoint: null,
  },
};

const BASE_REWARDS = {
  fallbackMultiplier: 1,
  multiplierAddress: '0x0000000000000000000000000000000000000000',
  rewardStreamAddress: '0x0000000000000000000000000000000000000000',
  providerUrl: 'http://localhost:8545',
  stream: {
    autoDistribute: false,
  },
};

const PROFILES = {
  'light-consumer': {
    modules: {
      'belief-sync': { enabled: true, config: { syncWindow: 'rolling', retentionHours: 72 } },
      'wallet-auth': { enabled: true, config: { tokenTtlMinutes: 30 } },
      'telemetry-core': {
        enabled: true,
        config: {
          sinks: ['file'],
          fallbackFile: 'starter-fallback.jsonl',
        },
        notes: 'Optimised for lean pilots. Advanced modules remain disabled.',
      },
      'streaming-rewards': { enabled: false },
      'cross-chain-forks': { enabled: false },
    },
    trustSync: {
      verification: {
        externalValidationEndpoint: null,
      },
    },
    rewards: {
      fallbackMultiplier: 1,
    },
  },
  analytics: {
    modules: {
      'belief-sync': { enabled: true, config: { syncWindow: 'batched', retentionHours: 168 } },
      'wallet-auth': { enabled: true, config: { tokenTtlMinutes: 60 } },
      'telemetry-core': {
        enabled: true,
        config: {
          sinks: ['warehouse', 'ops-metrics'],
        },
      },
      'analytics-insights': {
        enabled: true,
        config: { cadence: 'daily', warehouse: 's3://vaultfire-analytics' },
      },
      'streaming-rewards': { enabled: false },
    },
    trustSync: {
      verification: {
        externalValidationEndpoint: 'https://attest.vaultfire.test/analytics',
      },
    },
    rewards: {
      fallbackMultiplier: 1.05,
    },
  },
  'infra-integrator': {
    modules: {
      'belief-sync': { enabled: true, config: { syncWindow: 'continuous', retentionHours: 720 } },
      'wallet-auth': { enabled: true, config: { tokenTtlMinutes: 15 } },
      'telemetry-core': {
        enabled: true,
        config: {
          sinks: ['ops', 'compliance', 'partner-webhooks'],
        },
      },
      'streaming-rewards': {
        enabled: true,
        config: { streamContract: 'rewardStream', settlements: 'on-chain' },
      },
      'governance-webhooks': {
        enabled: true,
        config: {
          endpoints: ['https://hooks.partner.invalid/vaultfire'],
        },
      },
    },
    trustSync: {
      verification: {
        remote: {
          endpoint: 'https://trust.vaultfire.test/anchors',
          method: 'POST',
        },
        externalValidationEndpoint: 'https://attest.vaultfire.test/infra',
      },
    },
    rewards: {
      fallbackMultiplier: 1.1,
      stream: {
        autoDistribute: true,
      },
    },
  },
};

function deepMerge(base, override) {
  if (!override) {
    return base;
  }
  const output = Array.isArray(base) ? base.slice() : { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      (typeof output[key] === 'object' && output[key] !== null && !Array.isArray(output[key]))
    ) {
      output[key] = deepMerge(output[key], value);
    } else {
      output[key] = value;
    }
  }
  return output;
}

function buildConfig(partnerType) {
  const profile = PROFILES[partnerType];
  if (!profile) {
    throw new Error(`Unknown partner type: ${partnerType}`);
  }
  const config = {
    version: 1,
    partnerType,
    generatedAt: new Date().toISOString(),
    modules: profile.modules,
    trustSync: deepMerge(BASE_TRUST_SYNC, profile.trustSync || {}),
    rewards: deepMerge(BASE_REWARDS, profile.rewards || {}),
  };

  if (!validateConfigSchema(config)) {
    const errors = (validateConfigSchema.errors || [])
      .map((error) => `${error.instancePath || '/'} ${error.message}`.trim())
      .join('; ');
    throw new Error(`Generated configuration failed schema validation: ${errors}`);
  }

  return config;
}

function writeConfigFile(filePath, config, { force } = {}) {
  if (!force && fs.existsSync(filePath)) {
    throw new Error(`Configuration already exists at ${filePath}. Use --force to overwrite.`);
  }
  fs.writeFileSync(filePath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

function runCli(argv) {
  const program = new Command();
  program
    .name('pilot-launcher')
    .description('Generate Vaultfire starter configs tuned for partner pilots')
    .argument('<partner-type>', 'Partner profile (light-consumer|analytics|infra-integrator)')
    .option('-o, --output <path>', 'Output path for the generated config', '.vaultfirerc.json')
    .option('-f, --force', 'Overwrite existing configuration file', false)
    .action((partnerType, options) => {
      try {
        const config = buildConfig(partnerType);
        const outputPath = path.resolve(process.cwd(), options.output);
        writeConfigFile(outputPath, config, { force: options.force });
        // eslint-disable-next-line no-console
        console.log(`Generated ${partnerType} configuration at ${outputPath}`);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(error.message);
        process.exitCode = 1;
      }
    });

  program.parse(argv);
}

if (require.main === module) {
  runCli(process.argv);
}

module.exports = { buildConfig, runCli };
