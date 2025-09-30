jest.mock('../config/securityConfig', () => {
  const actual = jest.requireActual('../config/securityConfig');
  return {
    ...actual,
    loadSecurityConfig: jest.fn(),
    resolveActiveSecret: jest.fn(),
  };
});

const crypto = require('crypto');
const { loadSecurityConfig, resolveActiveSecret } = require('../config/securityConfig');
const SecurityPostureManager = require('../services/securityPosture');

const baseConfig = {
  cors: { allowedOrigins: [], allowedDomains: [] },
  telemetry: {},
  verification: { rotationGraceDays: 0, allowLegacyHandshake: false, secrets: [] },
  sandbox: { mode: 'sandbox', testEnsProfiles: [] },
  walletKeys: {},
};

const activeSecret = {
  id: 'test-secret',
  value: 'vaultfire-secret-token',
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

function createManager(overrides = {}, telemetry = { record: jest.fn() }) {
  loadSecurityConfig.mockReturnValue({ ...baseConfig, ...overrides });
  resolveActiveSecret.mockReturnValue({ current: activeSecret, previous: [], upcoming: [] });
  return { manager: new SecurityPostureManager({ telemetry }), telemetry };
}

describe('SecurityPostureManager handshake enforcement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('accepts payloads signed with the active secret', () => {
    const { manager, telemetry } = createManager();
    const wallet = '0xabc';
    const nonce = 'nonce-123';
    const timestamp = Date.now().toString();
    const digest = crypto
      .createHmac('sha256', activeSecret.value)
      .update(`${wallet.toLowerCase()}::${nonce}::${timestamp}`)
      .digest('hex');

    expect(() =>
      manager.assertHandshakeSecret({ nonce, timestamp, digest, secretId: activeSecret.id }, {
        wallet,
      })
    ).not.toThrow();
    expect(telemetry.record).not.toHaveBeenCalledWith('security.signature.failed', expect.anything(), expect.anything());
  });

  test('records telemetry and throws when secret is missing', () => {
    const { manager, telemetry } = createManager();

    let capturedError;
    try {
      manager.assertHandshakeSecret({ nonce: 'nonce', timestamp: Date.now().toString() }, { wallet: '0xabc' });
    } catch (error) {
      capturedError = error;
    }

    expect(capturedError).toBeInstanceOf(Error);
    expect(capturedError.message).toBe('Handshake secret invalid or expired');
    expect(capturedError.statusCode).toBe(401);

    const failureCall = telemetry.record.mock.calls.find(([event]) => event === 'security.signature.failed');
    expect(failureCall).toBeTruthy();
    expect(failureCall[1]).toMatchObject({ reason: 'payload_incomplete', phase: 'handshake', wallet: '0xabc' });
  });

  test('allows legacy handshake path when explicitly enabled', () => {
    const overrides = {
      verification: { ...baseConfig.verification, allowLegacyHandshake: true },
    };
    const { manager, telemetry } = createManager(overrides);

    expect(() => manager.assertHandshakeSecret(null, { wallet: '0xabc' })).not.toThrow();
    const legacyCall = telemetry.record.mock.calls.find(([event]) => event === 'security.signature.legacy');
    expect(legacyCall).toBeTruthy();
    expect(legacyCall[1]).toMatchObject({ wallet: '0xabc' });
  });
});

describe('SecurityPostureManager domain enforcement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('bypasses localhost but rejects unapproved domains', () => {
    const overrides = {
      cors: { allowedOrigins: [], allowedDomains: ['vaultfire.app'] },
    };
    const { manager, telemetry } = createManager(overrides);

    expect(() => manager.assertDomain('localhost')).not.toThrow();
    expect(() => manager.assertDomain('127.0.0.1')).not.toThrow();

    expect(() => manager.assertDomain('malicious.example.com')).toThrow('Domain not allowed');
    const rejectionCall = telemetry.record.mock.calls.find(([event]) => event === 'security.domain.rejected');
    expect(rejectionCall).toBeTruthy();
    expect(rejectionCall[1]).toMatchObject({ host: 'malicious.example.com' });
  });
});
