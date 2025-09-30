#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

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
    console.warn('[preflight] Missing peer dependencies:');
    missing.forEach((entry) => {
      const label = entry.optional ? 'optional' : 'required';
      console.warn(`  - ${entry.name}@${entry.version} (${label})`);
    });
  } else {
    console.log('[preflight] All peer dependencies resolved.');
  }
  return missing.every((entry) => entry.optional);
}

function checkNodeVersion(requiredRange) {
  const actual = parseVersion(process.version);
  const minimum = parseVersion(requiredRange);
  if (!minimum) {
    console.log(`[preflight] Node version requirement ${requiredRange} could not be parsed; skipping strict check.`);
    return true;
  }
  if (!isAtLeast(actual, minimum)) {
    console.error(
      `[preflight] Node ${process.version} does not satisfy minimum requirement ${requiredRange}. Please upgrade Node.js.`
    );
    return false;
  }
  console.log(`[preflight] Node version ${process.version} satisfies ${requiredRange}.`);
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
    warnings.forEach((warning) => console.warn(`[preflight] Environment warning: ${warning}`));
    return false;
  }
  console.log('[preflight] Environment checks passed.');
  return true;
}

(function run() {
  try {
    const pkg = loadPackageJson();
    const peerDepsOk = checkPeerDependencies(pkg.peerDependencies || {}, pkg.peerDependenciesMeta || {});
    const nodeRequirement = (pkg.engines && pkg.engines.node) || '>=18.18.0';
    const nodeOk = checkNodeVersion(nodeRequirement);
    const envOk = checkEnvironment();

    if (!peerDepsOk || !nodeOk || !envOk) {
      process.exitCode = 1;
    } else {
      process.exitCode = 0;
    }
  } catch (error) {
    console.error('[preflight] Failed to execute preflight check:', error.message);
    process.exitCode = 1;
  }
})();
