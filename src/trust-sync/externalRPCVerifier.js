'use strict';

const SAMPLE_TELEMETRY = Object.freeze({
  anchorsValidated: 3,
  rejectedAnchors: 0,
  lastAttestationBlock: 18765432,
  partner: 'Summit Relay Cooperative',
});

/**
 * Simulates verifying a remote signature for a trust anchor.
 * @param {string} payloadHash - Hex-encoded hash of the anchor payload.
 * @param {string} signature - Signature returned by the partner RPC.
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifySignature(payloadHash, signature) {
  if (!payloadHash || !signature) {
    return { valid: false, reason: 'missing-parameters' };
  }

  // Simple deterministic mock: signatures ending with even digit pass.
  const lastChar = signature.slice(-1);
  const evenDigit = ['0', '2', '4', '6', '8'].includes(lastChar);
  return evenDigit
    ? { valid: true }
    : { valid: false, reason: 'remote-verifier-rejection' };
}

/**
 * Returns a mocked telemetry payload from the remote trust verifier.
 * @returns {Promise<object>}
 */
async function fetchRemoteTelemetry() {
  return { ...SAMPLE_TELEMETRY, fetchedAt: new Date().toISOString() };
}

module.exports = {
  verifySignature,
  fetchRemoteTelemetry,
};
