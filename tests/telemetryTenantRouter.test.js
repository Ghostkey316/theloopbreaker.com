const fs = require('fs');
const os = require('os');
const path = require('path');
const { createTelemetryTenantRouter } = require('../services/telemetryTenantRouter');

describe('TelemetryTenantRouter', () => {
  test('isolates tenant telemetry streams under concurrent load', async () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfire-tenants-'));
    const router = createTelemetryTenantRouter({ baseDir });

    const tenants = ['alpha', 'beta', 'gamma'];
    const tasks = [];
    const perTenant = 25;

    for (const tenant of tenants) {
      for (let i = 0; i < perTenant; i += 1) {
        tasks.push(
          new Promise((resolve) => {
            setImmediate(() => {
              router.record(tenant, 'telemetry.partner.sync', { sequence: i });
              resolve();
            });
          })
        );
      }
    }

    // Include a default/public tenant event to verify routing fallback.
    router.record(null, 'telemetry.partner.sync', { sequence: 'public' });

    await Promise.all(tasks);
    await router.flushAll();

    const publicEntries = router.readChannel(null, 'partner');
    expect(publicEntries).toHaveLength(1);
    expect(publicEntries[0].payload.tenantId).toBe('public');

    for (const tenant of tenants) {
      const entries = router.readChannel(tenant, 'partner');
      expect(entries).toHaveLength(perTenant);
      const sequences = new Set(entries.map((entry) => entry.payload.sequence));
      expect(sequences.size).toBe(perTenant);
      entries.forEach((entry) => {
        expect(entry.payload.tenantId).toBe(tenant);
        expect(entry.eventType).toBe('telemetry.partner.sync');
      });
    }

    const unknownEntries = router.readChannel('non-existent', 'partner');
    expect(unknownEntries).toEqual([]);
  });
});
