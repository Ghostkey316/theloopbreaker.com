'use strict';

const { createResidencyGuard } = require('../residencyGuard');

describe('mobile summary smoke check', () => {
  it('logs a compact success summary for mobile audiences', () => {
    const guard = createResidencyGuard({
      enforce: true,
      defaultRegion: 'us',
      telemetry: { us: ['telemetry.us.vaultfire.xyz'] },
      partnerHooks: { us: ['hooks.us.vaultfire.xyz'] },
    });
    const result = guard.ensureEndpointAllowed('https://telemetry.us.vaultfire.xyz', {
      kind: 'telemetry',
      region: 'us',
    });
    expect(result.allowed).toBe(true);
    // eslint-disable-next-line no-console
    console.log('[MOBILE TEST] ✔ telemetry guard passed • region US allowed');
  });
});
