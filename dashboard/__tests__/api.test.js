'use strict';

describe('dashboard services api', () => {
  afterEach(() => {
    if (global.fetch) {
      delete global.fetch;
    }
    jest.resetModules();
  });

  it('clamps nested metadata to fit within the viewport budget', async () => {
    const api = require('../src/services/api');
    const metadata = {
      description: 'a'.repeat(5000),
      details: { note: 'b'.repeat(2000) },
    };
    const result = api.clampMetadataForViewport(metadata, 120);
    expect(result.description.length).toBeLessThan(metadata.description.length);
    expect(result.__truncated__).toBe(true);
  });

  it('enforces viewport budget on payload metadata', () => {
    const api = require('../src/services/api');
    const payload = {
      metadata: { longText: 'c'.repeat(4000) },
      meta: { nested: { content: 'd'.repeat(2000) } },
    };
    const trimmed = api.enforceViewportBudget(payload);
    expect(trimmed.metadata.__budget__).toBeDefined();
    expect(JSON.stringify(trimmed.meta).length).toBeLessThanOrEqual(JSON.stringify(payload.meta).length);
  });

  it('returns fallback status when API responds with null payload', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(null),
    });
    const api = require('../src/services/api');
    const status = await api.fetchStatus();
    expect(status.manifest.name).toBe('Vaultfire Protocol');
    expect(status.ethics.tags).toContain('ethics-anchor');
  });
});
