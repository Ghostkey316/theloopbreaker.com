'use strict';

const fs = require('fs');
const path = require('path');
const YAML = require('yamljs');

const DEFAULT_THRESHOLDS = {
  multiplierCritical: 1.0,
  summaryWarning: 1.05,
  quorum: 0.66,
  escalationWarning: 0.8,
};

const DEFAULT_CONFIG = {
  thresholds: { ...DEFAULT_THRESHOLDS },
  compliance: {
    contacts: [],
    requiresDualApproval: true,
  },
  auditPassed: false,
};

function deepMerge(base = {}, override = {}) {
  const result = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof base[key] === 'object' &&
      base[key] !== null &&
      !Array.isArray(base[key])
    ) {
      result[key] = deepMerge(base[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function parseConfigFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.yaml' || ext === '.yml') {
    return YAML.parse(raw);
  }
  if (ext === '.govrc') {
    try {
      return JSON.parse(raw);
    } catch (error) {
      return YAML.parse(raw);
    }
  }
  return JSON.parse(raw);
}

function resolveConfigPath({ argv = process.argv, cwd = process.cwd() } = {}) {
  const cliArg = argv
    .slice(2)
    .find((token) => token.startsWith('--config-path='))
    ?.split('=')[1];
  if (cliArg) {
    return path.resolve(cwd, cliArg);
  }
  if (process.env.VAULTFIRE_GOV_CONFIG) {
    return path.resolve(cwd, process.env.VAULTFIRE_GOV_CONFIG);
  }
  const rcPath = path.join(cwd, '.govrc');
  if (fs.existsSync(rcPath)) {
    return rcPath;
  }
  return null;
}

function loadGovernanceConfig(options = {}) {
  const { argv = process.argv, cwd = process.cwd(), defaultConfig = DEFAULT_CONFIG } = options;
  const configPath = resolveConfigPath({ argv, cwd });
  let loadedConfig = { ...defaultConfig };
  let usingDefaults = true;
  let source = 'defaults';

  if (configPath && fs.existsSync(configPath)) {
    try {
      const parsed = parseConfigFile(configPath);
      loadedConfig = deepMerge(defaultConfig, parsed || {});
      usingDefaults = false;
      source = configPath;
    } catch (error) {
      console.warn(`governance-core: failed to parse ${configPath}: ${error.message}`);
    }
  }

  const thresholds = deepMerge(DEFAULT_THRESHOLDS, loadedConfig.thresholds || {});
  loadedConfig.thresholds = thresholds;
  if (typeof loadedConfig.auditPassed !== 'boolean') {
    loadedConfig.auditPassed = Boolean(loadedConfig.compliance?.auditPassed);
  }
  const thresholdsEqualDefaults = Object.keys(DEFAULT_THRESHOLDS).every(
    (key) => Number(thresholds[key]) === Number(DEFAULT_THRESHOLDS[key])
  );
  if (thresholdsEqualDefaults) {
    usingDefaults = true;
  }

  if (usingDefaults) {
    console.warn(
      'governance-core: using default governance thresholds. Provide a .govrc file or --config-path override for production.'
    );
  }

  return {
    config: loadedConfig,
    source,
    usingDefaults,
  };
}

function auditGovernanceConfig(config = {}) {
  const result = {
    ok: true,
    warnings: [],
    errors: [],
  };
  const { thresholds = {}, compliance = {} } = config;

  if (typeof thresholds.multiplierCritical !== 'number') {
    result.errors.push('multiplierCritical must be defined as a number.');
    result.ok = false;
  }
  if (typeof thresholds.summaryWarning !== 'number') {
    result.errors.push('summaryWarning must be defined as a number.');
    result.ok = false;
  }
  if (typeof thresholds.quorum !== 'number') {
    result.warnings.push('quorum not configured; default quorum 0.66 will be used.');
  }

  if (
    typeof thresholds.multiplierCritical === 'number' &&
    typeof thresholds.summaryWarning === 'number' &&
    thresholds.multiplierCritical >= thresholds.summaryWarning
  ) {
    result.ok = false;
    result.errors.push(
      'multiplierCritical must be lower than summaryWarning to ensure early blocking occurs before warning thresholds.'
    );
  }
  if (
    typeof thresholds.quorum === 'number' &&
    (thresholds.quorum <= 0 || thresholds.quorum > 1)
  ) {
    result.ok = false;
    result.errors.push('quorum must be between 0 and 1.');
  }
  if (
    typeof thresholds.escalationWarning === 'number' &&
    typeof thresholds.multiplierCritical === 'number' &&
    thresholds.escalationWarning <= thresholds.multiplierCritical
  ) {
    result.warnings.push('escalationWarning should exceed multiplierCritical for tiered signalling.');
  }
  if (!Array.isArray(compliance.contacts) || compliance.contacts.length === 0) {
    result.warnings.push('No compliance contacts configured; partner escalation paths may be delayed.');
  }
  if (!compliance.requiresDualApproval) {
    result.warnings.push('Dual approval for governance overrides is disabled. Enable it for audit resilience.');
  }

  result.ok = result.ok && result.errors.length === 0;
  return result;
}

function logRuntimeEvent(message, { level = 'info', details = {}, config = DEFAULT_CONFIG } = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    details,
    config: {
      auditPassed: Boolean(config.auditPassed),
    },
  };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(entry));
  return entry;
}

function runAudit(argv = process.argv) {
  const { config } = loadGovernanceConfig({ argv });
  const outcome = auditGovernanceConfig(config);
  config.auditPassed = outcome.ok && outcome.errors.length === 0;
  const logLevel = outcome.ok ? 'info' : 'error';
  logRuntimeEvent('governance.audit.summary', {
    level: logLevel,
    details: outcome,
    config,
  });
  if (!outcome.ok) {
    outcome.errors.forEach((error) => {
      logRuntimeEvent(error, { level: 'error', config });
    });
  }
  return outcome;
}

if (require.main === module) {
  const shouldAudit = process.argv.slice(2).some((token) => token === '--audit');
  if (shouldAudit) {
    const outcome = runAudit(process.argv);
    if (!outcome.ok) {
      process.exitCode = 1;
    }
  } else {
    const { config, source } = loadGovernanceConfig({ argv: process.argv });
    logRuntimeEvent('governance.config.loaded', {
      details: { source },
      config,
    });
  }
}

module.exports = {
  DEFAULT_THRESHOLDS,
  DEFAULT_CONFIG,
  loadGovernanceConfig,
  auditGovernanceConfig,
  logRuntimeEvent,
  runAudit,
};
