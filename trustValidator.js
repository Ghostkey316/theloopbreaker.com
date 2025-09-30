let ethers;
try {
  ({ ethers } = require('ethers'));
} catch (error) {
  ethers = null;
}

class TrustValidationError extends Error {
  constructor(message, { code = 'trust.invalid', meta = null } = {}) {
    super(message);
    this.name = 'TrustValidationError';
    this.code = code;
    if (meta) {
      this.meta = meta;
    }
  }
}

function decodeMaybeBase64(value) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    try {
      const decoded = Buffer.from(value, 'base64').toString('utf8');
      return JSON.parse(decoded);
    } catch (inner) {
      return value;
    }
  }
}

class TrustValidator {
  constructor({
    allowedOrigins = [],
    sessionWindowMs = 5 * 60 * 1000,
    clock = () => Date.now(),
    signatureVerifier = null,
    clockDriftMs = 30_000,
  } = {}) {
    this.allowedOrigins = Array.isArray(allowedOrigins)
      ? allowedOrigins.filter(Boolean).map((o) => o.toLowerCase())
      : [];
    this.sessionWindowMs = Math.max(60_000, sessionWindowMs || 60_000);
    this.clock = typeof clock === 'function' ? clock : () => Date.now();
    this.clockDriftMs = Math.max(0, clockDriftMs || 0);
    this.signatureVerifier =
      typeof signatureVerifier === 'function' ? signatureVerifier : this.#defaultSignatureVerifier.bind(this);
  }

  #isOriginAllowed(origin) {
    if (!origin) {
      return false;
    }
    if (!this.allowedOrigins.length) {
      return true;
    }
    const normalised = origin.toLowerCase();
    return this.allowedOrigins.some((pattern) => {
      if (pattern === '*') {
        return true;
      }
      if (pattern.endsWith('*')) {
        return normalised.startsWith(pattern.slice(0, -1));
      }
      return normalised === pattern;
    });
  }

  #normaliseSession(session) {
    if (!session) {
      throw new TrustValidationError('Session token required', { code: 'trust.missing-session' });
    }

    const decoded = decodeMaybeBase64(session);
    if (typeof decoded === 'string') {
      throw new TrustValidationError('Session token format unsupported', { code: 'trust.invalid-session-format' });
    }
    if (typeof decoded !== 'object' || decoded === null) {
      throw new TrustValidationError('Session token must be an object', { code: 'trust.invalid-session' });
    }

    const issuedAt = Number(decoded.issuedAt ?? decoded.iat ?? decoded.issued_at);
    const expiresAt = Number(
      decoded.expiresAt ?? decoded.exp ?? decoded.expires_at ?? (Number.isFinite(issuedAt) ? issuedAt + this.sessionWindowMs : NaN),
    );
    const tokenId = decoded.id ?? decoded.tokenId ?? decoded.jti ?? null;

    if (!Number.isFinite(issuedAt)) {
      throw new TrustValidationError('Session issuedAt missing', { code: 'trust.missing-issued-at' });
    }
    if (!Number.isFinite(expiresAt)) {
      throw new TrustValidationError('Session expiresAt missing', { code: 'trust.missing-expires-at' });
    }
    if (expiresAt <= issuedAt) {
      throw new TrustValidationError('Session expiresAt must be after issuedAt', { code: 'trust.invalid-session-window' });
    }
    if (expiresAt - issuedAt > this.sessionWindowMs * 4) {
      throw new TrustValidationError('Session window exceeds maximum allowed duration', {
        code: 'trust.session-window-too-large',
      });
    }

    return {
      issuedAt,
      expiresAt,
      tokenId,
      raw: decoded,
    };
  }

  async #defaultSignatureVerifier({ address, signature, payload }) {
    if (!ethers) {
      throw new TrustValidationError('Signature verification unavailable', { code: 'trust.signature-deps-missing' });
    }
    if (!signature) {
      throw new TrustValidationError('Signature missing', { code: 'trust.missing-signature' });
    }
    if (!address) {
      throw new TrustValidationError('Address required for trust validation', { code: 'trust.missing-address' });
    }

    const serialised =
      typeof payload === 'string' ? payload : JSON.stringify(payload ?? {}, Object.keys(payload || {}).sort());

    const hashMessage = ethers?.hashMessage || ethers?.utils?.hashMessage;
    const recoverAddress = ethers?.recoverAddress || ethers?.utils?.recoverAddress;
    let recovered;
    try {
      if (typeof hashMessage !== 'function' || typeof recoverAddress !== 'function') {
        throw new Error('hash utilities unavailable');
      }
      const hash = hashMessage(serialised);
      recovered = recoverAddress(hash, signature);
    } catch (error) {
      throw new TrustValidationError('Invalid signature payload', {
        code: 'trust.bad-signature',
        meta: { reason: error?.message },
      });
    }

    if (recovered.toLowerCase() !== address.toLowerCase()) {
      throw new TrustValidationError('Signature does not match address', {
        code: 'trust.signature-mismatch',
      });
    }
    return true;
  }

  async validate({ origin, address, session, signature, payload }) {
    if (!this.#isOriginAllowed(origin || '')) {
      throw new TrustValidationError('Origin not allowed for trust relay', {
        code: 'trust.invalid-origin',
        meta: { origin },
      });
    }

    const normalisedSession = this.#normaliseSession(session);
    const now = this.clock();

    if (normalisedSession.issuedAt - this.clockDriftMs > now) {
      throw new TrustValidationError('Session issued in the future', {
        code: 'trust.session-future',
      });
    }

    if (now - normalisedSession.issuedAt > this.sessionWindowMs + this.clockDriftMs) {
      throw new TrustValidationError('Session has expired', {
        code: 'trust.session-expired',
      });
    }

    if (normalisedSession.expiresAt + this.clockDriftMs < now) {
      throw new TrustValidationError('Session expired', {
        code: 'trust.session-expired',
      });
    }

    await this.signatureVerifier({ address, signature, payload: payload ?? normalisedSession.raw });

    return {
      origin,
      address,
      session: normalisedSession,
    };
  }
}

function createTrustValidator(options = {}) {
  return new TrustValidator(options);
}

module.exports = {
  TrustValidator,
  TrustValidationError,
  createTrustValidator,
};
