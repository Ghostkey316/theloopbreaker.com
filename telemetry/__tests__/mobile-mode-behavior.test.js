'use strict';

describe('Vaultfire mobile mode toggles', () => {
  const originalEnv = process.env.MOBILE_MODE;

  afterEach(() => {
    jest.resetModules();
    if (originalEnv === undefined) {
      delete process.env.MOBILE_MODE;
    } else {
      process.env.MOBILE_MODE = originalEnv;
    }
    delete global.__VAULTFIRE_MOBILE_MODE;
  });

  it('does not relax residency enforcement by default in mobile mode', () => {
    process.env.MOBILE_MODE = 'true';
    jest.resetModules();
    const { createResidencyGuard } = require('../residencyGuard');
    const guard = createResidencyGuard({
      enforce: true,
      defaultRegion: 'us',
      telemetry: { us: ['telemetry.us.vaultfire.xyz'] },
    });
    expect(() => guard.ensureEndpointAllowed('https://example.invalid', {
      kind: 'telemetry',
      region: 'us',
    })).toThrow(/Residency enforcement blocked/);
    expect(guard.inspect().mobileRelaxed).toBe(false);
  });

  it('can explicitly relax residency enforcement in mobile mode when configured', () => {
    process.env.MOBILE_MODE = 'true';
    jest.resetModules();
    const { createResidencyGuard } = require('../residencyGuard');
    const guard = createResidencyGuard({
      enforce: true,
      relaxOnMobile: true,
      defaultRegion: 'us',
      telemetry: { us: ['telemetry.us.vaultfire.xyz'] },
    });
    const result = guard.ensureEndpointAllowed('https://example.invalid', {
      kind: 'telemetry',
      region: 'us',
    });
    expect(result.allowed).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.enforced).toBe(false);
    expect(guard.inspect().mobileRelaxed).toBe(true);
  });

  it('short-circuits partner hook adapter writes in mobile mode', async () => {
    process.env.MOBILE_MODE = 'true';
    jest.resetModules();
    const adapter = require('../adapters/partner_hook_adapter');
    const initResult = adapter.init('https://hooks.vaultfire.xyz');
    expect(initResult.mobileMode).toBe(true);
    await expect(adapter.writeTelemetry({ event: 'mobile' })).resolves.toEqual({ skipped: true });
  });

  it('prevents node telemetry from invoking Sentry when mobile runtime flag is set', () => {
    process.env.MOBILE_MODE = 'true';
    jest.resetModules();
    const Sentry = require('@sentry/node');
    const captureSpy = jest.spyOn(Sentry, 'captureMessage');
    const initSpy = jest.spyOn(Sentry, 'init');
    const telemetry = require('../nodeTelemetry');
    telemetry.trackEvent('belief.vote.cast', { wallet: '0x1234' });
    expect(captureSpy).not.toHaveBeenCalled();
    expect(initSpy).not.toHaveBeenCalled();
    captureSpy.mockRestore();
    initSpy.mockRestore();
  });

  it('honours global mobile overrides only when explicitly configured', () => {
    delete process.env.MOBILE_MODE;
    global.__VAULTFIRE_MOBILE_MODE = true;
    jest.resetModules();
    const { createResidencyGuard } = require('../residencyGuard');

    const guardDefault = createResidencyGuard({ enforce: true, defaultRegion: 'eu', telemetry: { eu: ['telemetry.eu'] } });
    expect(guardDefault.inspect().mobileRelaxed).toBe(false);

    const guardRelaxed = createResidencyGuard({
      enforce: true,
      relaxOnMobile: true,
      defaultRegion: 'eu',
      telemetry: { eu: ['telemetry.eu'] },
    });
    expect(guardRelaxed.inspect().mobileRelaxed).toBe(true);
  });
});
