import path from 'path';
import {
  authenticateWithFallback,
  clearFallbackSessions,
  getFallbackSession,
  getPartnerAuthStrategy,
} from '../auth/altIdentity';

const CONFIG_PATH = path.resolve(__dirname, '..', 'partner-auth-config.json');

describe('Alternative identity authentication', () => {
  beforeEach(() => {
    clearFallbackSessions();
  });

  it('authenticates with wallet when the identifier is valid', () => {
    const result = authenticateWithFallback('partner_xyz', 'ghostkey316.eth');
    expect(result.strategy).toBe('wallet');
    expect(result.wallet).toBe('ghostkey316.eth');
    expect(result.onChainAuthorityPreserved).toBe(true);
    expect(result.fallbackSession).toBeUndefined();
  });

  it('falls back to email + OTP when wallet auth fails for an opted-in partner', () => {
    const now = new Date('2025-10-08T12:00:00Z');
    const result = authenticateWithFallback(
      'partner_beta',
      'malformed###',
      { email: 'user@example.com', otp: '123456' },
      { now, configPath: CONFIG_PATH },
    );

    expect(result.strategy).toBe('email_otp');
    expect(result.wallet).toBeUndefined();
    expect(result.onChainAuthorityPreserved).toBe(false);
    expect(result.fallbackSession).toBeDefined();

    const session = result.fallbackSession!;
    expect(session.partnerId).toBe('partner_beta');
    expect(session.strategy).toBe('email_otp');
    expect(session.identity).toBe('user@example.com');
    expect(session.issuedAt).toBe(now.toISOString());
    expect(session.expiresAt).toBe(new Date(now.getTime() + 10 * 60 * 1000).toISOString());

    const lookup = getFallbackSession(session.sessionId);
    expect(lookup).toEqual(session);
  });

  it('supports GitHub OAuth fallback without overriding on-chain authority', () => {
    const token = 'abcdefghijklmnopqrstuvwxyz1234567890';
    const result = authenticateWithFallback(
      'partner_github_ops',
      'wallet??',
      { provider: 'github', token, email: 'maintainer@vaultfire.dev' },
      { configPath: CONFIG_PATH },
    );

    expect(result.strategy).toBe('oauth_github');
    expect(result.wallet).toBeUndefined();
    expect(result.onChainAuthorityPreserved).toBe(false);
    expect(result.fallbackSession?.metadata.provider).toBe('github');
    expect(result.fallbackSession?.metadata.email).toBe('maintainer@vaultfire.dev');

    const stored = getFallbackSession(result.fallbackSession!.sessionId);
    expect(stored?.metadata.tokenDigest).toHaveLength(64);
  });

  it('throws when a wallet-only partner fails wallet authentication', () => {
    expect(() =>
      authenticateWithFallback('unknown-partner', 'bad$$$', {}, { configPath: CONFIG_PATH }),
    ).toThrow('Invalid wallet identifier');
  });

  it('exposes partner strategy resolution for partner operations tooling', () => {
    expect(getPartnerAuthStrategy('partner_beta', CONFIG_PATH)).toBe('email_otp');
    expect(getPartnerAuthStrategy('nonexistent-partner', CONFIG_PATH)).toBe('wallet');
  });
});
