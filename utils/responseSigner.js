const crypto = require('crypto');

const { wrapObject, shouldEncrypt } = require('../lib/encryptionLayer');

const SIGNATURE_HEADER = 'X-Vaultfire-Signature';
const SIGNATURE_ALGORITHM_HEADER = 'X-Vaultfire-Signature-Alg';
const SIGNATURE_ISSUED_AT_HEADER = 'X-Vaultfire-Signature-Issued-At';
const SIGNATURE_ALGORITHM = 'HMAC-SHA256';
const ENCRYPTION_VERSION = 'v2.3';

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
  const component = options.encryptionComponent || options.component || 'partner-sync-response';
  const preserveKeys = Array.isArray(options.preserveKeys) ? options.preserveKeys : [];
  const payloadWithVersion = {
    ...payload,
    vaultfire_encryption_version: ENCRYPTION_VERSION,
  };
  const bodyPayload = shouldEncrypt(component)
    ? wrapObject(component, payloadWithVersion, { preserveKeys })
    : payloadWithVersion;
  const body = JSON.stringify(bodyPayload);
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
