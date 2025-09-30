'use strict';

jest.mock('node-fetch', () => jest.fn());

let fetchMock;

function mobileModeActive() {
  const env = typeof process !== 'undefined' && process && process.env ? process.env : {};
  const value = env.MOBILE_MODE;
  if (value === undefined || value === null) {
    return Boolean(global.__VAULTFIRE_MOBILE_MODE);
  }
  return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
}

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
    if (mobileModeActive()) {
      expect(result).toMatchObject({ partnerHookUrl: null, mobileMode: true });
    } else {
      expect(result.partnerHookUrl).toBe('https://example.com/hook');
    }
  });

  it('throws when writing telemetry before initialisation', async () => {
    const adapter = require('../adapters/partner_hook_adapter');
    if (mobileModeActive()) {
      await expect(adapter.writeTelemetry({ event: 'test' })).resolves.toEqual({ skipped: true });
    } else {
      await expect(adapter.writeTelemetry({ event: 'test' })).rejects.toThrow(/not initialised/);
    }
  });

  it('bubbles up non-OK responses as errors', async () => {
    const adapter = require('../adapters/partner_hook_adapter');
    adapter.init('https://example.com/hook', { residency });
    if (mobileModeActive()) {
      await expect(adapter.writeTelemetry({ event: 'failure' })).resolves.toEqual({ skipped: true });
    } else {
      fetchMock.mockResolvedValue({ ok: false, status: 500 });
      await expect(adapter.writeTelemetry({ event: 'failure' })).rejects.toThrow(/status 500/);
    }
  });
});
