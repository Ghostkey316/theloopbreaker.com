const ApiKeyGate = require('../services/handshake/apiKeyGate');
const GovernanceEnforcer = require('../services/handshake/governanceEnforcer');
const HandshakeJWTAuthority = require('../services/handshake/jwtAuthority');
const { SecretsManager } = require('../services/secretsManager');

describe('Handshake module primitives', () => {
  test('api key gate validates configured keys', () => {
    const secretsManager = {
      getSecret: (key) => {
        if (key === 'VAULTFIRE_HANDSHAKE_API_KEYS') {
          return 'alpha, beta';
        }
        return null;
      },
    };
    const gate = new ApiKeyGate({ secretsManager });
    const valid = gate.verify({ headers: { 'x-api-key': 'alpha' } });
    expect(valid.valid).toBe(true);
    const invalid = gate.verify({ headers: { 'x-api-key': 'gamma' } });
    expect(invalid.valid).toBe(false);
    expect(invalid.reason).toBe('invalid_key');
  });

  test('governance enforcer flags drift and multiplier floor', () => {
    const enforcer = new GovernanceEnforcer({ thresholds: { multiplierCritical: 1, summaryWarning: 1.05 } });
    const result = enforcer.assess({ multiplier: 0.8, summaryScore: 0.9 });
    expect(result.status).toBe('blocked');
    expect(result.alerts.some((alert) => alert.type === 'multiplier.floor')).toBe(true);
    expect(result.alerts.some((alert) => alert.type === 'summary.threshold')).toBe(true);
  });

  test('jwt authority issues and verifies tokens with secrets manager', () => {
    const secretsManager = new SecretsManager({
      providers: [
        {
          getSecret: (key) => {
            if (key === 'VAULTFIRE_HANDSHAKE_ACCESS_SECRET') {
              return 'handshake-secret';
            }
            return null;
          },
        },
      ],
    });
    const authority = new HandshakeJWTAuthority({ secretsManager });
    const token = authority.issue({ wallet: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', role: 'partner', partnerId: 'test' });
    const verification = authority.verify(token);
    expect(verification.valid).toBe(true);
    expect(verification.payload.partnerId).toBe('test');
  });
});
