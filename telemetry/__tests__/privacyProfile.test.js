'use strict';

jest.mock('@sentry/node', () => {
  const sentry = {
    init: jest.fn(),
    captureMessage: jest.fn(),
  };
  sentry.__scopes = [];
  sentry.withScope = jest.fn((callback) => {
    const scope = {
      setUser: jest.fn(),
      setTag: jest.fn(),
      setContext: jest.fn(),
      setFingerprint: jest.fn(),
    };
    callback(scope);
    sentry.__scopes.push(scope);
  });
  return sentry;
});

jest.mock('../../config/trustSyncConfig', () => ({
  loadTrustSyncConfig: jest.fn(() => ({ telemetry: { residency: { enforce: true, defaultRegion: 'us', telemetry: {} } } })),
}));

jest.mock('../nodeConsentStore', () => ({
  hasOptIn: jest.fn((wallet) => (wallet ? wallet.toLowerCase() === '0xabc' : false)),
  setOptIn: jest.fn(() => ({ enabled: true })),
  normalizeWallet: jest.fn((wallet) => wallet && wallet.toLowerCase()),
}));

jest.mock('../residencyGuard', () => ({
  createResidencyGuard: jest.fn(() => ({
    ensureEndpointAllowed: jest.fn(),
    inspect: jest.fn(() => ({ mobileRelaxed: false })),
  })),
}));

describe('privacy profile (telemetry)', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete process.env.MOBILE_MODE;
  });

  it('never attaches stable user identity to third-party telemetry scopes', () => {
    const Sentry = require('@sentry/node');
    const telemetry = require('../nodeTelemetry');

    telemetry.initTelemetry({ dsn: 'https://example.dsn/123', environment: 'production' });
    telemetry.trackEvent('belief.vote.cast', {
      wallet: '0xABC',
      metadata: { resonanceBucket: 'alpha' },
      tags: { network: 'mainnet', pilot: 'sandbox' },
    });

    expect(Sentry.captureMessage).toHaveBeenCalledWith('belief.vote.cast', 'info');
    const scope = Sentry.__scopes.at(-1);

    // Privacy: no stable identity in third-party sink.
    expect(scope.setUser).toHaveBeenCalledWith(null);

    // Privacy: avoid fingerprinting across events/time.
    expect(scope.setFingerprint).toHaveBeenCalledWith(['belief.vote.cast']);

    // Ensure we are not leaking wallet identifiers via tags.
    const tagCalls = scope.setTag.mock.calls.map((c) => [c[0], c[1]]);
    const tagText = JSON.stringify(tagCalls).toLowerCase();
    expect(tagText).not.toContain('0xabc');
    expect(tagText).not.toContain('wallet');
  });
});
