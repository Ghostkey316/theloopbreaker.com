const fs = require('fs');
const os = require('os');
const path = require('path');

const { createTelemetryTenantRouter } = require('../services/telemetryTenantRouter');

function buildTelemetryPayload(sequence, tenantId) {
  return {
    event: 'telemetry.partner.sync',
    timestamp: Math.floor(Date.now() / 1000),
    payload: {
      sequence,
      tenantId,
      device: 'mobile',
    },
    consentToken: `consent-${tenantId || 'public'}-token`,
    driftScore: 0.1,
  };
}

describe('TelemetryTenantRouter', () => {
  test('isolates tenant telemetry streams under concurrent load', async () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfire-tenants-'));
    const router = createTelemetryTenantRouter({ baseDir });

    const tenants = ['alpha', 'beta', 'gamma'];
    const perTenant = 25;
    const tasks = [];

    for (const tenant of tenants) {
      for (let i = 0; i < perTenant; i += 1) {
        tasks.push(
          router.record(tenant, 'telemetry.partner.sync', {
            telemetry: buildTelemetryPayload(i, tenant),
          })
        );
      }
    }

    await router.record(null, 'telemetry.partner.sync', {
      telemetry: buildTelemetryPayload('public', null),
    });

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

  test('testTenantIsolationNoRace', async () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultfire-tenants-quota-'));
    const router = createTelemetryTenantRouter({ baseDir });

    const flushEvents = [];
    const unsubscribe = router.onFlush((payload) => {
      flushEvents.push(JSON.parse(payload));
    });

    router.useTenantQuota({ limit: 5, windowMs: 50 });

    const tenantId = 'quota-tenant';
    const accepted = [];
    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      accepted.push(await router.record(tenantId, 'telemetry.partner.sync', {
        telemetry: buildTelemetryPayload(i, tenantId),
      }));
    }

    await expect(
      router.record(tenantId, 'telemetry.partner.sync', {
        telemetry: buildTelemetryPayload('limit', tenantId),
      })
    ).rejects.toMatchObject({ code: 'TENANT_QUOTA_EXCEEDED' });

    await router.flushAll();
    expect(flushEvents.length).toBeGreaterThan(0);
    flushEvents.forEach((event) => {
      expect(event).toHaveProperty('tenantId');
    });

    unsubscribe();
    expect(accepted).toHaveLength(5);
  });
});
