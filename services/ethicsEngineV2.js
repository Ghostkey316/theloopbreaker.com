const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LOG_DIR = path.join(process.cwd(), 'logs');
const REFLECTION_LOG = path.join(LOG_DIR, 'ethics-reflection.log');
const CHECKPOINT_LOG = path.join(LOG_DIR, 'ethics-checkpoints.log');

function ensureLog(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '', 'utf8');
  }
}

function append(filePath, entry) {
  ensureLog(filePath);
  fs.appendFileSync(filePath, `${JSON.stringify(entry)}\n`, { encoding: 'utf8' });
}

function normalizeWallet(wallet) {
  return (wallet || '').toLowerCase().trim() || null;
}

function normalizeEns(ens) {
  const value = (ens || '').toLowerCase().trim();
  return value || null;
}

function reflect(context = {}) {
  const timestamp = new Date().toISOString();
  const wallet = normalizeWallet(context.wallet);
  const ens = normalizeEns(context.ens);
  const payload = {
    timestamp,
    command: context.command || 'unknown',
    wallet,
    ens,
    tags: Array.isArray(context.tags) ? context.tags : ['codex-cli'],
    policyVersion: 'ethics-v2',
  };
  payload.digest = crypto
    .createHash('sha256')
    .update(JSON.stringify({ timestamp, command: payload.command, wallet, ens, tags: payload.tags }))
    .digest('hex');
  append(REFLECTION_LOG, payload);
  return payload;
}

function checkpoint({ command, status, digest, proof } = {}) {
  const timestamp = new Date().toISOString();
  const entry = {
    timestamp,
    command: command || 'unknown',
    status: status || 'unknown',
    policyVersion: 'ethics-v2',
    digest: digest || null,
    proof: proof || null,
  };
  entry.hash = crypto
    .createHash('sha256')
    .update(`${entry.timestamp}:${entry.command}:${entry.status}:${entry.digest || ''}`)
    .digest('hex');
  append(CHECKPOINT_LOG, entry);
  return entry;
}

module.exports = { reflect, checkpoint };
