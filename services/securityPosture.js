const crypto = require('crypto');
const {
  loadSecurityConfig,
  resolveActiveSecret,
  isDomainAllowed,
} = require('../config/securityConfig');

function toLower(value) {
  return typeof value === 'string' ? value.toLowerCase() : value;
}

function toBuffer(value) {
  if (typeof value !== 'string' || !value) {
    return null;
  }
  try {
    return Buffer.from(value, 'hex');
  } catch (error) {
    return null;
  }
}

class SecurityPostureManager {
  constructor({ telemetry } = {}) {
    this.telemetry = telemetry || null;
    this.refresh();
  }

  refresh() {
    this.config = loadSecurityConfig();
    this.rotation = resolveActiveSecret(this.config);
  }

  getActiveSecret() {
    return this.rotation?.current || null;
  }

  getRotation() {
    return this.rotation;
  }

  allowsLegacyHandshake() {
    return Boolean(this.config?.verification?.allowLegacyHandshake);
  }

  requiresHandshake() {
    return Boolean(this.getActiveSecret()?.value);
  }

  getHandshakeSnapshot() {
    const current = this.getActiveSecret();
    return {
      status: current ? 'rotating' : 'legacy',
      secret: current?.value || null,
      secretId: current?.id || null,
      expiresAt: current?.expiresAt || null,
      posture: {
        algorithm: 'HMAC-SHA256',
        rotationGraceDays: this.config?.verification?.rotationGraceDays || 0,
        allowLegacyHandshake: this.allowsLegacyHandshake(),
      },
    };
  }

  #record(event, payload, options) {
    if (!this.telemetry || typeof this.telemetry.record !== 'function') {
      return;
    }
    const defaultOptions = {
      tags: ['security'],
      visibility: { partner: false, ethics: true, audit: true },
    };
    this.telemetry.record(event, payload, options || defaultOptions);
  }

  #candidateSecrets() {
    const candidates = [];
    const current = this.getActiveSecret();
    if (current) {
      candidates.push(current);
    }

    const graceDays = Number(this.config?.verification?.rotationGraceDays || 0);
    if (!graceDays || !Array.isArray(this.rotation?.previous)) {
      return candidates;
    }

    const graceWindowMs = graceDays * 24 * 60 * 60 * 1000;
    if (!graceWindowMs) {
      return candidates;
    }

    const now = Date.now();
    for (const secret of this.rotation.previous) {
      const expiresAt = Date.parse(secret.expiresAt);
      if (Number.isFinite(expiresAt) && now - expiresAt <= graceWindowMs) {
        candidates.push(secret);
      }
    }
    return candidates;
  }

  #handshakePayload({ wallet, nonce, timestamp }) {
    return `${wallet || ''}::${nonce || ''}::${timestamp || ''}`;
  }

  #timingSafeEqual(expected, actual) {
    const expectedBuffer = toBuffer(expected);
    const actualBuffer = toBuffer(actual);
    if (!expectedBuffer || !actualBuffer || expectedBuffer.length !== actualBuffer.length) {
      return false;
    }
    try {
      return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
    } catch (error) {
      return false;
    }
  }

  #fail(reason, context = {}) {
    this.#record('security.signature.failed', { reason, phase: 'handshake', ...context });
    const error = new Error('Handshake secret invalid or expired');
    error.statusCode = 401;
    throw error;
  }

  assertHandshakeSecret(handshake, { wallet } = {}) {
    const normalizedWallet = toLower(wallet || '');
    const candidates = this.#candidateSecrets();

    if (!handshake || typeof handshake !== 'object') {
      if (candidates.length) {
        if (this.allowsLegacyHandshake()) {
          this.#record('security.signature.legacy', { wallet: normalizedWallet, reason: 'handshake_payload_missing' });
          return { secret: null, legacy: true };
        }
        return this.#fail('secret_missing', { wallet: normalizedWallet });
      }
      this.#record('security.signature.legacy', { wallet: normalizedWallet, reason: 'no_active_secret' });
      return { secret: null, legacy: true };
    }

    if (!candidates.length) {
      this.#record('security.signature.legacy', { wallet: normalizedWallet, reason: 'no_active_secret' });
      return { secret: null, legacy: true };
    }

    const { nonce, timestamp, digest, secretId } = handshake;
    if (!nonce || !timestamp || !digest) {
      return this.#fail('secret_mismatch', { wallet: normalizedWallet, reason: 'payload_incomplete' });
    }

    const payload = this.#handshakePayload({ wallet: normalizedWallet, nonce, timestamp });

    for (const secret of candidates) {
      if (secretId && secret.id !== secretId) {
        continue;
      }
      const expected = crypto.createHmac('sha256', secret.value).update(payload).digest('hex');
      if (this.#timingSafeEqual(expected, digest)) {
        const ts = Number(timestamp);
        if (Number.isFinite(ts)) {
          const drift = Math.abs(Date.now() - ts);
          if (drift > 5 * 60 * 1000) {
            this.#record('security.signature.warning', {
              wallet: normalizedWallet,
              reason: 'timestamp_drift',
              driftMs: drift,
              secretId: secret.id,
            });
          }
        }
        return { secret, legacy: false };
      }
    }

    if (this.allowsLegacyHandshake()) {
      this.#record('security.signature.legacy', {
        wallet: normalizedWallet,
        reason: 'digest_mismatch_legacy_fallback',
        providedSecretId: secretId || null,
      });
      return { secret: null, legacy: true };
    }

    return this.#fail('secret_mismatch', { wallet: normalizedWallet, providedSecretId: secretId || null });
  }

  assertDomain(domain) {
    if (!domain) {
      return;
    }
    const normalized = toLower(domain);
    if (normalized === 'localhost' || normalized === '127.0.0.1') {
      return;
    }
    if (isDomainAllowed(this.config, normalized)) {
      return;
    }
    this.#record('security.domain.rejected', { host: normalized });
    throw new Error('Domain not allowed');
  }
}

module.exports = SecurityPostureManager;
