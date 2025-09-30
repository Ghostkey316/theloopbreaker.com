'use strict';

const fs = require('fs');
const path = require('path');

const MODULE_REGISTRY = {
  cli: {
    name: 'CLI',
    path: './cli/vaultfire-cli.js',
    require: true,
  },
  dashboard: {
    name: 'Dashboard',
    path: './dashboard',
    require: false,
  },
  beliefEngine: {
    name: 'Belief Engine',
    path: './belief_sync_engine.js',
    require: true,
  },
  apis: {
    name: 'APIs',
    path: './auth/expressExample.js',
    require: true,
  },
  telemetry: {
    name: 'Telemetry',
    path: './services/telemetryLedger.js',
    require: true,
  },
  governance: {
    name: 'Governance',
    path: './governance/governance-core.js',
    require: true,
  },
};

const PILOT_SCOPE = ['cli', 'dashboard', 'beliefEngine'];
const FULL_SCOPE = Object.keys(MODULE_REGISTRY);

function normalizeBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (!value) {
    return false;
  }
  const normalized = String(value).trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

function resolveScope(argv = process.argv) {
  const scopeArg = argv
    .slice(2)
    .find((token) => token.startsWith('--scope='))
    ?.split('=')[1];
  if (scopeArg) {
    return scopeArg.trim().toLowerCase();
  }
  const envScope = process.env.VAULTFIRE_MODULE_SCOPE;
  if (envScope) {
    return envScope.trim().toLowerCase();
  }
  const pilotMode =
    normalizeBoolean(process.env.pilot_mode) ||
    normalizeBoolean(process.env.PILOT_MODE);
  return pilotMode ? 'pilot' : 'full';
}

function resolveModuleDefinition(key) {
  const definition = MODULE_REGISTRY[key];
  if (!definition) {
    throw new Error(`Unknown module key: ${key}`);
  }
  const absolutePath = path.resolve(__dirname, definition.path);
  return { ...definition, absolutePath };
}

function safeRequire(definition) {
  if (!definition.require) {
    return { status: 'referenced', module: definition.absolutePath };
  }
  if (!fs.existsSync(definition.absolutePath)) {
    return {
      status: 'missing',
      error: new Error(`Module path not found: ${definition.absolutePath}`),
    };
  }
  try {
    const mod = require(definition.absolutePath); // eslint-disable-line global-require, import/no-dynamic-require
    return { status: 'loaded', module: mod };
  } catch (error) {
    return { status: 'error', error };
  }
}

function loadModulesForScope(scope) {
  const normalizedScope = scope === 'pilot' ? 'pilot' : 'full';
  const keys = normalizedScope === 'pilot' ? PILOT_SCOPE : FULL_SCOPE;
  const results = keys.map((key) => {
    const definition = resolveModuleDefinition(key);
    const outcome = safeRequire(definition);
    return {
      key,
      name: definition.name,
      path: definition.absolutePath,
      ...outcome,
    };
  });
  return {
    scope: normalizedScope,
    modules: results,
  };
}

function logResults({ scope, modules }) {
  // eslint-disable-next-line no-console
  console.log(`pilot-loader: initialising in ${scope} scope`);
  for (const moduleResult of modules) {
    const baseMessage = ` → ${moduleResult.name}`;
    if (moduleResult.status === 'loaded') {
      // eslint-disable-next-line no-console
      console.log(`${baseMessage} loaded from ${moduleResult.path}`);
    } else if (moduleResult.status === 'referenced') {
      // eslint-disable-next-line no-console
      console.log(`${baseMessage} referenced at ${moduleResult.path}`);
    } else {
      const reason = moduleResult.error ? moduleResult.error.message : 'unknown reason';
      // eslint-disable-next-line no-console
      console.warn(`${baseMessage} unavailable (${reason})`);
    }
  }
  return modules;
}

function runLoader(argv = process.argv) {
  const scope = resolveScope(argv);
  const result = loadModulesForScope(scope);
  logResults(result);
  return result;
}

if (require.main === module) {
  runLoader(process.argv);
}

module.exports = {
  resolveScope,
  loadModulesForScope,
  runLoader,
  PILOT_SCOPE,
  FULL_SCOPE,
};
