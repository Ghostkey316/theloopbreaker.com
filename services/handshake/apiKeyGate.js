class ApiKeyGate {
  constructor({ secretsManager, telemetry, headerNames } = {}) {
    this.secretsManager = secretsManager;
    this.telemetry = telemetry || null;
    this.headerNames = headerNames || ['x-api-key', 'x-vaultfire-api-key', 'x-vf-handshake-key'];
    this.cachedKeys = null;
  }

  loadKeys() {
    if (this.cachedKeys) {
      return this.cachedKeys;
    }
    const raw = this.secretsManager?.getSecret('VAULTFIRE_HANDSHAKE_API_KEYS');
    const single = this.secretsManager?.getSecret('VAULTFIRE_HANDSHAKE_API_KEY');
    const values = [raw, single]
      .filter(Boolean)
      .flatMap((entry) => String(entry).split(',').map((value) => value.trim()))
      .filter(Boolean);
    this.cachedKeys = new Set(values);
    return this.cachedKeys;
  }

  verify(req) {
    const keys = this.loadKeys();
    if (!keys || keys.size === 0) {
      return { valid: false, reason: 'no_keys_configured' };
    }
    for (const header of this.headerNames) {
      const provided = req.headers?.[header];
      if (!provided) {
        continue;
      }
      const normalized = String(provided).trim();
      for (const candidate of keys) {
        if (candidate && this.safeCompare(candidate, normalized)) {
          return { valid: true, key: candidate };
        }
      }
    }
    this.telemetry?.record('handshake.apikey.rejected', { headers: this.headerNames }, {
      tags: ['handshake', 'api-key'],
      visibility: { partner: false, ethics: true, audit: true },
    });
    return { valid: false, reason: 'invalid_key' };
  }

  safeCompare(expected, actual) {
    if (!expected || !actual) {
      return false;
    }
    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(actual);
    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }
    try {
      return require('crypto').timingSafeEqual(expectedBuffer, actualBuffer);
    } catch (error) {
      return false;
    }
  }
}

module.exports = ApiKeyGate;
