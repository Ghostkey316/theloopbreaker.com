'use strict';

jest.mock('node-fetch', () => jest.fn());

let fetchMock;

describe('telemetry partner hook adapter', () => {
  const residency = {
    enforce: true,
    defaultRegion: 'eu-central-1',
    partnerHooks: {
      'eu-central-1': ['example.com', '*.example.com'],
    },
  };

  beforeEach(() => {
    jest.resetModules();
    fetchMock = require('node-fetch');
    fetchMock.mockReset();
  });

  it('initialises with provided partner URL and custom fetch', () => {
    const adapter = require('../adapters/partner_hook_adapter');
    const customFetch = jest.fn();
    const result = adapter.init(null, {
      partnerUrl: 'https://example.com/hook',
      fetch: customFetch,
      residency,
    });
    expect(result.partnerHookUrl).toBe('https://example.com/hook');
  });

  it('throws when writing telemetry before initialisation', async () => {
    const adapter = require('../adapters/partner_hook_adapter');
    await expect(adapter.writeTelemetry({ event: 'test' })).rejects.toThrow(/not initialised/);
  });

  it('bubbles up non-OK responses as errors', async () => {
    const adapter = require('../adapters/partner_hook_adapter');
    adapter.init('https://example.com/hook', { residency });
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    await expect(adapter.writeTelemetry({ event: 'failure' })).rejects.toThrow(/status 500/);
  });
});
