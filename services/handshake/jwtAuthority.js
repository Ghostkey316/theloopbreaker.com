const TokenService = require('../../auth/tokenService');

class HandshakeJWTAuthority {
  constructor({ secretsManager, telemetry, tokenService } = {}) {
    this.telemetry = telemetry || null;
    this.secretsManager = secretsManager;
    const secret = secretsManager?.getSecret('VAULTFIRE_HANDSHAKE_ACCESS_SECRET', {
      fallback: secretsManager?.getSecret('VAULTFIRE_ACCESS_SECRET', { fallback: 'vaultfire-dev-access' }),
    });
    this.tokenService = tokenService || new TokenService({ accessSecret: secret });
  }

  issue(payload) {
    return this.tokenService.createAccessToken(payload);
  }

  verify(token, { tags = [] } = {}) {
    try {
      const decoded = this.tokenService.verifyAccessToken(token);
      return { valid: true, payload: decoded };
    } catch (error) {
      this.telemetry?.record('handshake.jwt.invalid', { reason: error.message }, {
        tags: ['handshake', 'jwt', ...tags],
        visibility: { partner: false, ethics: true, audit: true },
      });
      return { valid: false, error };
    }
    // TODO(handshake-jwt-rotation): add automated rotation once secrets manager integrates with remote HSM.
  }
}

module.exports = HandshakeJWTAuthority;
