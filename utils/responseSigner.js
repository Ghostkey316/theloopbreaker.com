const crypto = require('crypto');

const SIGNATURE_HEADER = 'X-Vaultfire-Signature';
const SIGNATURE_ALGORITHM_HEADER = 'X-Vaultfire-Signature-Alg';
const SIGNATURE_ISSUED_AT_HEADER = 'X-Vaultfire-Signature-Issued-At';
const SIGNATURE_ALGORITHM = 'HMAC-SHA256';

function resolveSigningSecret({ signingSecret, securityPosture } = {}) {
  if (signingSecret) {
    return signingSecret;
  }

  if (securityPosture && typeof securityPosture.getActiveSecret === 'function') {
    const active = securityPosture.getActiveSecret();
    if (active?.value) {
      return active.value;
    }
  }

  return process.env.VAULTFIRE_RESPONSE_SIGNING_SECRET || 'vaultfire-response-signing-dev';
}

function computeSignature(payloadString, secret) {
  return crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
}

function sendSignedJson(res, payload, options = {}) {
  const secret = resolveSigningSecret(options);
  const body = JSON.stringify(payload);
  const signature = computeSignature(body, secret);
  const issuedAt = new Date().toISOString();

  res.set(SIGNATURE_HEADER, signature);
  res.set(SIGNATURE_ALGORITHM_HEADER, SIGNATURE_ALGORITHM);
  res.set(SIGNATURE_ISSUED_AT_HEADER, issuedAt);
  res.type('application/json');
  res.send(body);
  return res;
}

module.exports = {
  sendSignedJson,
  resolveSigningSecret,
  computeSignature,
  SIGNATURE_HEADER,
  SIGNATURE_ALGORITHM,
  SIGNATURE_ALGORITHM_HEADER,
  SIGNATURE_ISSUED_AT_HEADER,
};
