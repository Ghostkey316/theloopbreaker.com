'use strict';

jest.mock('socket.io-client', () => ({
  io: jest.fn(),
}));

describe('dashboard services api', () => {
  let api;
  let ioMock;
  let originalWindow;
  let originalNavigator;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    originalWindow = global.window;
    originalNavigator = global.navigator;
    ({ io: ioMock } = require('socket.io-client'));
  });

  afterEach(() => {
    if (global.fetch) {
      delete global.fetch;
    }
    if (originalWindow === undefined) {
      delete global.window;
    } else {
      global.window = originalWindow;
    }
    if (originalNavigator === undefined) {
      delete global.navigator;
    } else {
      global.navigator = originalNavigator;
    }
    jest.resetModules();
  });

  function createSocket() {
    const handlers = new Map();
    return {
      on: jest.fn((event, handler) => {
        handlers.set(event, handler);
      }),
      off: jest.fn((event, handler) => {
        if (handlers.get(event) === handler) {
          handlers.delete(event);
        }
      }),
      emit: (event, payload) => {
        const handler = handlers.get(event);
        if (handler) {
          handler(payload);
        }
      },
      disconnect: jest.fn(),
    };
  }

  it('clamps nested metadata to fit within the viewport budget', async () => {
    api = require('../src/services/api');
    const metadata = {
      description: 'a'.repeat(5000),
      details: { note: 'b'.repeat(2000) },
    };
    const result = api.clampMetadataForViewport(metadata, 120);
    expect(result.description.length).toBeLessThan(metadata.description.length);
    expect(result.__truncated__).toBe(true);
  });

  it('enforces viewport budget on payload metadata', () => {
    api = require('../src/services/api');
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
    api = require('../src/services/api');
    const status = await api.fetchStatus();
    expect(status.manifest.name).toBe('Vaultfire Protocol');
    expect(status.ethics.tags).toContain('ethics-anchor');
  });

  it('sends sync payloads and triggers haptics when requested', async () => {
    const socket = createSocket();
    ioMock.mockReturnValue(socket);
    global.window = {
      innerWidth: 1280,
      innerHeight: 720,
      devicePixelRatio: 1,
      navigator: {
        vibrate: jest.fn(),
      },
    };
    global.navigator = global.window.navigator;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    });
    api = require('../src/services/api');

    const payload = {
      metadata: {
        description: 'x'.repeat(4000),
        triggerHaptics: true,
      },
    };

    const response = await api.syncBeliefPayload(payload, { mode: 'pilot', triggerHaptics: true });
    expect(response.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:4050/vaultfire/sync-belief', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'X-Vaultfire-Mode': 'pilot' }),
    }));
    const [, fetchOptions] = global.fetch.mock.calls[0];
    const parsedBody = JSON.parse(fetchOptions.body);
    expect(parsedBody.metadata.triggerHaptics).toBe(true);
    expect(global.window.navigator.vibrate).toHaveBeenCalled();
  });

  it('surfaces API errors from fetchSyncStatus', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: { message: 'not allowed' } }),
    });
    api = require('../src/services/api');
    await expect(api.fetchSyncStatus()).rejects.toThrow('not allowed');
  });

  it('subscribes to sync updates and cleans up socket listeners', () => {
    const socket = createSocket();
    ioMock.mockReturnValue(socket);
    api = require('../src/services/api');

    const onSync = jest.fn();
    const onError = jest.fn();
    const dispose = api.subscribeToSync({ onSync, onError });

    socket.emit('belief-sync', { beliefScore: 0.9 });
    expect(onSync).toHaveBeenCalledWith({ beliefScore: 0.9 });

    socket.emit('connect_error', new Error('socket down'));
    expect(onError).toHaveBeenCalledWith('socket down');

    dispose();
    expect(socket.disconnect).toHaveBeenCalled();
  });

  it('subscribes to observability channel and logs when no error handler is provided', () => {
    const socket = createSocket();
    ioMock.mockReturnValue(socket);
    api = require('../src/services/api');
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const dispose = api.subscribeToObservability({ onUpdate: jest.fn() });
    socket.emit('connect_error', new Error('offline'));
    expect(warnSpy).toHaveBeenCalledWith('Observability socket error', 'offline');

    dispose();
    expect(socket.disconnect).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('returns fallbacks when telemetry endpoints return null', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(null) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(null) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(null) });
    api = require('../src/services/api');

    const observability = await api.fetchObservability();
    const security = await api.fetchSecurityPosture();
    const handshake = await api.fetchHandshakeSecret();
    expect(observability.status).toBe('offline');
    expect(security.status).toBe('unknown');
    expect(handshake.status).toBe('unavailable');
  });

  it('retrieves staging profiles and passes through payloads', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ profiles: ['ens1'] }),
    });
    api = require('../src/services/api');
    const result = await api.fetchStagingProfiles();
    expect(result.profiles).toContain('ens1');
  });
});
