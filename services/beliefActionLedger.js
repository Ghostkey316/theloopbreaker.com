const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function ensureFile(targetPath) {
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(targetPath)) {
    fs.writeFileSync(targetPath, '', 'utf8');
  }
}

class BeliefActionLedger {
  constructor({ telemetry, logPath } = {}) {
    this.telemetry = telemetry;
    this.logPath = logPath || path.join(__dirname, '..', 'logs', 'belief-actions-ledger.jsonl');
    ensureFile(this.logPath);
  }

  #hashValue(value) {
    return crypto.createHash('sha256').update(String(value)).digest('hex');
  }

  #append(entry) {
    fs.appendFileSync(this.logPath, `${JSON.stringify(entry)}\n`, 'utf8');
  }

  registerSignature({ walletId, action, signature, metadata = {} }) {
    const timestamp = new Date().toISOString();
    const walletHash = this.#hashValue(walletId || metadata.identity || 'unknown');
    const actionDigest = this.#hashValue(action || JSON.stringify(metadata));
    const signatureDigest = signature ? this.#hashValue(signature) : null;
    const ledgerEntry = {
      timestamp,
      walletHash,
      actionDigest,
      signatureDigest,
      metadata,
    };
    this.#append(ledgerEntry);
    this.telemetry?.record(
      'belief.action.signature',
      {
        walletHash,
        actionDigest,
        signatureDigest,
        metadata,
      },
      {
        tags: ['belief', 'onchain'],
        visibility: { partner: true, ethics: true, audit: true },
      }
    );
    return ledgerEntry;
  }
}

module.exports = BeliefActionLedger;
