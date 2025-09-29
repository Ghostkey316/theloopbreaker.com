const jwt = require('jsonwebtoken');
const TokenService = require('../auth/tokenService');
const RefreshStore = require('../auth/refreshStore');
const { ROLES } = require('../auth/roles');

describe('TokenService', () => {
  const refreshStore = new RefreshStore({ ttlMinutes: 1 });
  const service = new TokenService({ refreshStore, accessSecret: 'test-secret', accessTtl: '5m' });

  it('creates and verifies access tokens', () => {
    const token = service.createAccessToken({
      userId: 'user-123',
      role: ROLES.PARTNER,
      partnerId: 'partner-1',
      scopes: ['belief:sync'],
    });

    const decoded = service.verifyAccessToken(token);
    expect(decoded.sub).toBe('user-123');
    expect(decoded.role).toBe(ROLES.PARTNER);
  });

  it('refreshes access tokens using refresh tokens', () => {
    const { token: refreshToken } = service.createRefreshToken({
      userId: 'user-123',
      role: ROLES.PARTNER,
      partnerId: 'partner-1',
      scopes: ['belief:sync'],
    });

    const refreshed = service.refreshAccessToken(refreshToken);
    expect(refreshed).toBeTruthy();
    expect(jwt.decode(refreshed.accessToken).sub).toBe('user-123');
  });

  it('returns null for expired refresh tokens', () => {
    const shortStore = new RefreshStore({ ttlMinutes: 0 });
    const shortService = new TokenService({ refreshStore: shortStore, accessSecret: 'test-secret' });
    const { token: refreshToken } = shortService.createRefreshToken({
      userId: 'expired-user',
      role: ROLES.CONTRIBUTOR,
      partnerId: 'partner-2',
    });

    expect(shortService.refreshAccessToken(refreshToken)).toBeNull();
  });
});
