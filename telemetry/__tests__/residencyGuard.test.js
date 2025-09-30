const { createResidencyGuard } = require('../residencyGuard');

function mobileModeActive() {
  const env = typeof process !== 'undefined' && process && process.env ? process.env : {};
  const value = env.MOBILE_MODE;
  if (value === undefined || value === null) {
    return Boolean(global.__VAULTFIRE_MOBILE_MODE);
  }
  return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
}

describe('telemetry/residencyGuard', () => {
  const baseConfig = {
    enforce: true,
    defaultRegion: 'eu-central-1',
    telemetry: {
      'eu-central-1': ['o*.ingest.sentry.io', 'telemetry.eu.vaultfire.xyz'],
    },
    partnerHooks: {
      'eu-central-1': ['hooks.eu.vaultfire.xyz', '*.partners.eu.vaultfire.xyz'],
    },
  };

  it('allows telemetry host when pattern matches region rules', () => {
    const guard = createResidencyGuard(baseConfig);
    expect(() =>
      guard.ensureEndpointAllowed('https://o123.ingest.sentry.io/42', {
        kind: 'telemetry',
        label: 'sentry dsn',
      })
    ).not.toThrow();
  });

  it('allows wildcard partner host matches', () => {
    const guard = createResidencyGuard(baseConfig);
    expect(() =>
      guard.ensureEndpointAllowed('https://team.partners.eu.vaultfire.xyz/hooks', {
        kind: 'partnerHooks',
        label: 'partner hook',
      })
    ).not.toThrow();
  });

  it('throws when host is not permitted for the region', () => {
    const guard = createResidencyGuard(baseConfig);
    if (mobileModeActive()) {
      const result = guard.ensureEndpointAllowed('https://hooks.us.vaultfire.xyz', {
        kind: 'partnerHooks',
        label: 'partner hook',
      });
      expect(result.skipped).toBe(true);
    } else {
      expect(() =>
        guard.ensureEndpointAllowed('https://hooks.us.vaultfire.xyz', {
          kind: 'partnerHooks',
          label: 'partner hook',
        })
      ).toThrow(/blocked/);
    }
  });

  it('uses global allow list when region rules are absent', () => {
    const guard = createResidencyGuard({
      enforce: true,
      defaultRegion: 'ap-southeast-1',
      allowedEndpoints: { telemetry: {} },
      globalAllowList: ['telemetry.global.vaultfire.xyz'],
    });

    expect(() =>
      guard.ensureEndpointAllowed('https://telemetry.global.vaultfire.xyz/ingest', {
        kind: 'telemetry',
        label: 'global telemetry',
      })
    ).not.toThrow();
  });

  it('raises for invalid URLs when enforcement is on', () => {
    const guard = createResidencyGuard({ enforce: true, defaultRegion: 'eu-central-1' });
    if (mobileModeActive()) {
      const result = guard.ensureEndpointAllowed('not-a-valid-url');
      expect(result.skipped).toBe(true);
    } else {
      expect(() => guard.ensureEndpointAllowed('not-a-valid-url')).toThrow(/Invalid/);
    }
  });

  it('reports inspection metadata including mobile relaxation flag', () => {
    const guard = createResidencyGuard(baseConfig);
    const inspection = guard.inspect();
    expect(inspection).toMatchObject({
      enforced: !mobileModeActive(),
      mobileRelaxed: mobileModeActive(),
    });
  });
});
