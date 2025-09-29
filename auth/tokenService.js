const jwt = require('jsonwebtoken');
const RefreshStore = require('./refreshStore');
const { assertRole } = require('./roles');

const DEFAULT_ACCESS_TTL = '15m';
const DEFAULT_REFRESH_TTL_MINUTES = 60 * 12; // 12 hours

class TokenService {
  constructor({
    accessSecret = process.env.VAULTFIRE_ACCESS_SECRET || 'vaultfire-dev-access',
    refreshStore = new RefreshStore({ ttlMinutes: DEFAULT_REFRESH_TTL_MINUTES }),
    accessTtl = DEFAULT_ACCESS_TTL,
  } = {}) {
    this.accessSecret = accessSecret;
    this.refreshStore = refreshStore;
    this.accessTtl = accessTtl;
  }

  createAccessToken(payload) {
    assertRole(payload.role);
    return jwt.sign(
      {
        sub: payload.userId,
        role: payload.role,
        scopes: payload.scopes || [],
        partnerId: payload.partnerId,
        beliefVector: payload.beliefVector || null,
      },
      this.accessSecret,
      { expiresIn: this.accessTtl }
    );
  }

  createRefreshToken(payload) {
    const entry = this.refreshStore.create(payload.userId, {
      role: payload.role,
      partnerId: payload.partnerId,
      beliefVector: payload.beliefVector || null,
      scopes: payload.scopes || [],
    });
    return entry;
  }

  verifyAccessToken(token) {
    return jwt.verify(token, this.accessSecret);
  }

  refreshAccessToken(refreshToken) {
    const entry = this.refreshStore.verify(refreshToken);
    if (!entry) {
      return null;
    }

    const { meta, userId } = entry;
    const newToken = this.createAccessToken({
      userId,
      role: meta.role,
      partnerId: meta.partnerId,
      beliefVector: meta.beliefVector,
      scopes: meta.scopes || [],
    });
    return {
      accessToken: newToken,
      expiresIn: jwt.decode(newToken).exp,
    };
  }

  revokeRefreshToken(token) {
    this.refreshStore.revoke(token);
  }
}

module.exports = TokenService;
