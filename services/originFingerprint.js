const crypto = require('crypto');

function normalize(value) {
  return (value || '').toLowerCase().trim();
}

function createFingerprint({ wallet, ens }) {
  const normalizedWallet = normalize(wallet);
  const normalizedEns = normalize(ens) || null;
  const basis = normalizedEns ? `ens:${normalizedEns}` : `wallet:${normalizedWallet}`;
  const fingerprint = crypto.createHash('sha256').update(basis).digest('hex');
  return {
    fingerprint,
    basis,
    method: normalizedEns ? 'ens' : 'wallet',
  };
}

module.exports = { createFingerprint };
