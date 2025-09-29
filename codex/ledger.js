const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { createFingerprint } = require('../services/originFingerprint');

const LEDGER_PATH = process.env.VAULTFIRE_CODEX_LEDGER
  ? path.resolve(process.env.VAULTFIRE_CODEX_LEDGER)
  : path.join(__dirname, 'VAULTFIRE_CLI_LEDGER.jsonl');

function ensureLedger() {
  const dir = path.dirname(LEDGER_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(LEDGER_PATH)) {
    fs.writeFileSync(LEDGER_PATH, '', 'utf8');
  }
}

function readLastEntry() {
  if (!fs.existsSync(LEDGER_PATH)) {
    return null;
  }
  const content = fs.readFileSync(LEDGER_PATH, 'utf8').trim();
  if (!content) {
    return null;
  }
  const lastNewline = content.lastIndexOf('\n');
  const lastLine = lastNewline >= 0 ? content.slice(lastNewline + 1) : content;
  try {
    return JSON.parse(lastLine);
  } catch (error) {
    return null;
  }
}

function append(entry) {
  ensureLedger();
  fs.appendFileSync(LEDGER_PATH, `${JSON.stringify(entry)}\n`, { encoding: 'utf8' });
}

function normalizeWallet(wallet) {
  return (wallet || '0x0000000000000000000000000000000000000000').toLowerCase();
}

function normalizeEns(ens) {
  const value = (ens || '').toLowerCase().trim();
  return value || null;
}

function createBeliefProof({ payload, wallet, ens }) {
  const normalizedWallet = normalizeWallet(wallet);
  const normalizedEns = normalizeEns(ens);
  const { fingerprint } = createFingerprint({ wallet: normalizedWallet, ens: normalizedEns });
  const canonical = JSON.stringify({ wallet: normalizedWallet, ens: normalizedEns, fingerprint, payload });
  const hash = crypto.createHash('sha256').update(canonical).digest('hex');
  const basis = normalizedEns ? `${normalizedEns}:${hash}` : `${normalizedWallet}:${hash}`;
  const signature = crypto.createHash('sha256').update(basis).digest('hex');
  return { hash, signature, fingerprint };
}

function recordCliEvent({ command, wallet, ens, status, proof, digest }) {
  const normalizedWallet = normalizeWallet(wallet);
  const normalizedEns = normalizeEns(ens);
  const timestamp = new Date().toISOString();
  const previous = readLastEntry();
  const body = {
    timestamp,
    command,
    wallet: normalizedWallet,
    ens: normalizedEns,
    status: status || 'unknown',
    proof: proof ? { hash: proof.hash, signature: proof.signature } : null,
    digest: digest || null,
    prev: previous?.hash || null,
  };
  const hash = crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');
  const entry = { ...body, hash };
  append(entry);
  return entry;
}

module.exports = { recordCliEvent, createBeliefProof };
