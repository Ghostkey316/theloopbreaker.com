#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function resolveCommitUrl(remoteUrl, hash) {
  if (!remoteUrl || !hash) return null;
  if (remoteUrl.startsWith('git@')) {
    const [, remainder] = remoteUrl.split('git@');
    if (!remainder) return null;
    const [host, repoPath] = remainder.split(':');
    if (!host || !repoPath) return null;
    const cleanRepo = repoPath.replace(/\.git$/, '');
    return `https://${host}/${cleanRepo}/commit/${hash}`;
  }
  if (remoteUrl.startsWith('https://') || remoteUrl.startsWith('http://')) {
    const cleanRepo = remoteUrl.replace(/\.git$/, '');
    return `${cleanRepo.replace(/\/$/, '')}/commit/${hash}`;
  }
  return null;
}

function ensureLinks(manifest) {
  if (!manifest.links || typeof manifest.links !== 'object') {
    manifest.links = {};
  }
  if (!manifest.links.commit || typeof manifest.links.commit !== 'object') {
    manifest.links.commit = { hash: null, url: null };
  }
}

function main() {
  const rootDir = path.join(__dirname, '..');
  const packagePath = path.join(rootDir, 'package.json');
  const manifestPath = path.join(rootDir, 'manifest.json');

  const pkg = readJSON(packagePath);
  const manifest = readJSON(manifestPath);
  const versionTag = `v${pkg.version}`;

  ensureLinks(manifest);
  manifest.semanticVersion = versionTag;

  try {
    const commitHash = execSync('git rev-parse HEAD').toString().trim();
    manifest.links.commit.hash = commitHash || null;
    try {
      const remoteUrl = execSync('git config --get remote.origin.url').toString().trim();
      manifest.links.commit.url = resolveCommitUrl(remoteUrl, commitHash);
    } catch (remoteError) {
      manifest.links.commit.url = null;
    }
  } catch (error) {
    manifest.links.commit.hash = null;
    manifest.links.commit.url = null;
  }

  writeJSON(manifestPath, manifest);
  console.log(`[vaultfire] Updated manifest semanticVersion to ${manifest.semanticVersion}`);
  if (manifest.links.commit.hash) {
    console.log(`[vaultfire] Linked commit ${manifest.links.commit.hash}`);
  } else {
    console.warn('[vaultfire] Unable to resolve git commit hash for manifest');
  }
}

if (require.main === module) {
  main();
}
