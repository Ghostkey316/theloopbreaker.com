#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const wrapAnsiImport = require('wrap-ansi');
const wrapAnsi = typeof wrapAnsiImport === 'function' ? wrapAnsiImport : wrapAnsiImport.default;
const { loadTrustSyncConfig } = require('../config/trustSyncConfig');
const { createResidencyGuard } = require('../telemetry/residencyGuard');

const isBrowserRuntime = typeof window !== 'undefined';
const processEnv = typeof process !== 'undefined' && process && process.env ? process.env : {};

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
}

function isMobileModeActive() {
  if (isBrowserRuntime) {
    return true;
  }
  return toBoolean(processEnv.MOBILE_MODE, false);
}

function terminalWidth() {
  const defaultWidth = 80;
  if (!process || !process.stdout || !process.stdout.columns) {
    return defaultWidth;
  }
  return Math.max(40, Math.min(100, process.stdout.columns));
}

function formatLine(message, formatter = (value) => value) {
  const wrapped = wrapAnsi(message, terminalWidth(), { hard: true });
  return formatter(wrapped);
}

function logInfo(message) {
  console.log(formatLine(`ℹ ${message}`, (value) => chalk.cyan(value)));
}

function logWarn(message) {
  console.warn(formatLine(`⚠ ${message}`, (value) => chalk.yellow(value)));
}

function logError(message) {
  console.error(formatLine(`✖ ${message}`, (value) => chalk.red(value)));
}

function loadPackageJson() {
  const pkgPath = path.join(__dirname, '..', 'package.json');
  const raw = fs.readFileSync(pkgPath, 'utf8');
  return JSON.parse(raw);
}

function parseVersion(input) {
  const match = String(input).match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    return null;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function isAtLeast(actual, minimum) {
  if (!actual || !minimum) {
    return true;
  }
  if (actual.major !== minimum.major) {
    return actual.major > minimum.major ? true : actual.major === minimum.major;
  }
  if (actual.minor !== minimum.minor) {
    return actual.minor > minimum.minor ? true : actual.minor === minimum.minor;
  }
  return actual.patch >= minimum.patch;
}

function checkPeerDependencies(peerDeps, meta = {}) {
  const missing = [];
  for (const dep of Object.keys(peerDeps || {})) {
    try {
      require.resolve(dep);
    } catch (error) {
      missing.push({ name: dep, version: peerDeps[dep], optional: Boolean(meta[dep]?.optional) });
    }
  }
  if (missing.length) {
    logWarn('Missing peer dependencies detected.');
    missing.forEach((entry) => {
      const label = entry.optional ? 'optional' : 'required';
      logWarn(`  - ${entry.name}@${entry.version} (${label})`);
    });
  } else {
    logInfo('All peer dependencies resolved.');
  }
  return missing.every((entry) => entry.optional);
}

function checkNodeVersion(requiredRange) {
  const actual = parseVersion(process.version);
  const minimum = parseVersion(requiredRange);
  if (!minimum) {
    logInfo(`Node version requirement ${requiredRange} could not be parsed; skipping strict check.`);
    return true;
  }
  if (!isAtLeast(actual, minimum)) {
    logError(`Node ${process.version} does not satisfy minimum requirement ${requiredRange}. Please upgrade Node.js.`);
    return false;
  }
  logInfo(`Node version ${process.version} satisfies ${requiredRange}.`);
  return true;
}

function checkEnvironment() {
  const warnings = [];
  if (typeof window !== 'undefined') {
    warnings.push('Browser global detected; Vaultfire preflight expects a Node.js runtime.');
  }
  if (!process || process.release?.name !== 'node') {
    warnings.push('Non-Node.js runtime detected. CLI utilities require Node.');
  }
  if (!process.versions?.openssl) {
    warnings.push('OpenSSL bindings missing; crypto handshakes may fail.');
  }
  if (warnings.length) {
    warnings.forEach((warning) => logWarn(`Environment warning: ${warning}`));
    return false;
  }
  logInfo('Environment checks passed.');
  return true;
}

function checkTelemetryResidency() {
  try {
    const config = loadTrustSyncConfig();
    const residency = config?.telemetry?.residency;
    if (!residency) {
      logError('Missing telemetry.residency configuration.');
      return false;
    }
    const guard = createResidencyGuard(residency);
    const inspection = guard.inspect();
    if (!inspection.enforced) {
      logError('Telemetry residency enforcement is disabled. Enable residency.enforce to protect partner data.');
      return false;
    }
    if (!inspection.defaultRegion) {
      logError('telemetry.residency.defaultRegion is not configured.');
      return false;
    }
    const telemetryPatterns = inspection.summary.telemetry?.[inspection.defaultRegion] || [];
    const partnerPatterns = inspection.summary.partnerHooks?.[inspection.defaultRegion] || [];
    if (!telemetryPatterns.length || !partnerPatterns.length) {
      logError(
        `Residency rules incomplete for region ${inspection.defaultRegion}. Configure telemetry and partnerHooks host allow-lists.`
      );
      return false;
    }
      logInfo(
        `Residency enforcement enabled for ${inspection.defaultRegion}. Telemetry hosts: ${telemetryPatterns.join(
          ', '
        )}. Partner hooks: ${partnerPatterns.join(', ')}.`
      );
    return true;
  } catch (error) {
    logError(`Unable to validate telemetry residency: ${error.message}`);
    return false;
  }
}

(function run() {
  if (isMobileModeActive()) {
    logInfo('Mobile mode detected. Skipping Vaultfire preflight CLI checks.');
    process.exitCode = 0;
    return;
  }
  try {
    const pkg = loadPackageJson();
    const peerDepsOk = checkPeerDependencies(pkg.peerDependencies || {}, pkg.peerDependenciesMeta || {});
    const nodeRequirement = (pkg.engines && pkg.engines.node) || '>=18.18.0';
    const nodeOk = checkNodeVersion(nodeRequirement);
    const envOk = checkEnvironment();
    const residencyOk = checkTelemetryResidency();

    if (!peerDepsOk || !nodeOk || !envOk || !residencyOk) {
      process.exitCode = 1;
    } else {
      process.exitCode = 0;
    }
  } catch (error) {
    logError(`Failed to execute preflight check: ${error.message}`);
    process.exitCode = 1;
  }
})();
