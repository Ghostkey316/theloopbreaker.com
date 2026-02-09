#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function readIfExists(p) {
  try {
    return fs.readFileSync(p);
  } catch {
    return null;
  }
}

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (err) {
    return null;
  }
}

(function main() {
  const repoRoot = path.join(__dirname, '..');
  const artifactsDir = path.join(repoRoot, 'artifacts');
  fs.mkdirSync(artifactsDir, { recursive: true });

  const receipt = {
    kind: 'vaultfire.verify.receipt',
    version: 1,
    createdAtUtc: new Date().toISOString(),
    repo: {
      path: repoRoot,
      git: {
        commit: run('git rev-parse HEAD'),
        branch: run('git branch --show-current'),
        status: run('git status -sb'),
        remote: run('git remote -v')
      }
    },
    runtime: {
      node: process.version,
      platform: process.platform,
      arch: process.arch
    },
    inputs: {
      'package.json': null,
      'package-lock.json': null,
      'README.md': null
    }
  };

  for (const file of Object.keys(receipt.inputs)) {
    const abs = path.join(repoRoot, file);
    const buf = readIfExists(abs);
    if (!buf) continue;
    receipt.inputs[file] = {
      path: file,
      bytes: buf.length,
      sha256: sha256(buf)
    };
  }

  // Tamper-evident receipt hash (hash of canonical JSON string)
  const canonical = JSON.stringify(receipt);
  receipt.receiptSha256 = sha256(Buffer.from(canonical, 'utf8'));

  const outPath = path.join(artifactsDir, 'verify-receipt.json');
  fs.writeFileSync(outPath, JSON.stringify(receipt, null, 2) + '\n', 'utf8');

  const outHashPath = path.join(artifactsDir, 'verify-receipt.sha256');
  fs.writeFileSync(outHashPath, `${receipt.receiptSha256}  verify-receipt.json\n`, 'utf8');

  console.log(`Wrote verification receipt: ${outPath}`);
  console.log(`Receipt SHA256: ${receipt.receiptSha256}`);
})();
