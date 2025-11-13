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

let Sentry;
let loadTrustSyncConfig;
let consentStore;
let telemetry;

describe('node telemetry', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete process.env.MOBILE_MODE;
    Sentry = require('@sentry/node');
    ({ loadTrustSyncConfig } = require('../../config/trustSyncConfig'));
    consentStore = require('../nodeConsentStore');
    telemetry = require('../nodeTelemetry');
  });

  it('initialises Sentry when not in mobile mode and applies residency config', () => {
    telemetry.initTelemetry({ dsn: 'https://example.dsn/123', environment: 'production' });
    expect(loadTrustSyncConfig).toHaveBeenCalled();
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ dsn: 'https://example.dsn/123', environment: 'production' })
    );
  });

  it('skips telemetry initialisation when mobile mode flag is set', () => {
    process.env.MOBILE_MODE = 'true';
    jest.resetModules();
    const mobileTelemetry = require('../nodeTelemetry');
    mobileTelemetry.initTelemetry({ dsn: 'https://example.dsn/123' });
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('tracks events only when consent is present and sanitises context payloads', () => {
    telemetry.initTelemetry({ dsn: 'https://example.dsn/123' });
    telemetry.trackEvent('belief.vote.cast', {
      wallet: '0xABC',
      metadata: { resonanceBucket: 'north-star', clientVersion: 'x'.repeat(600) },
      tags: { network: 'mainnet', drop: undefined, pilot: 'sandbox' },
    });

    expect(consentStore.normalizeWallet).toHaveBeenCalledWith('0xABC');
    expect(Sentry.captureMessage).toHaveBeenCalledWith('belief.vote.cast', 'info');
    expect(Sentry.withScope).toHaveBeenCalled();
    const scope = Sentry.__scopes.at(-1);
    expect(scope.setTag).toHaveBeenCalledWith('event', 'belief.vote.cast');
    expect(scope.setContext).toHaveBeenCalledWith(
      'details',
      expect.objectContaining({ metadata: { resonanceBucket: 'north-star' } })
    );
    expect(scope.setContext.mock.calls[0][1].metadata).not.toHaveProperty('clientVersion');
    expect(scope.setTag).toHaveBeenCalledWith('ctx_network', 'mainnet');
    expect(scope.setTag).toHaveBeenCalledWith('ctx_pilot', 'sandbox');
  });

  it('exposes consent helpers through module exports', () => {
    expect(telemetry.hasConsent('0xABC')).toBe(true);
    expect(telemetry.updateConsent('0xabc', true)).toEqual({ enabled: true });
    expect(consentStore.setOptIn).toHaveBeenCalledWith('0xabc', true, { filePath: undefined });
  });

  it('ignores tracking when wallet is missing or consent absent', () => {
    telemetry.trackEvent('belief.vote.cast', {});
    telemetry.trackEvent('belief.vote.cast', { wallet: '0xDEF' });
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it('rejects events that are not described in the telemetry schema', () => {
    telemetry.initTelemetry({ dsn: 'https://example.dsn/123' });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    telemetry.trackEvent('custom.event', { wallet: '0xABC', metadata: { resonanceBucket: 'alpha' } });

    expect(Sentry.captureMessage).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('custom.event'));
    warnSpy.mockRestore();
  });
});
