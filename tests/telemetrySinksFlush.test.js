const { TelemetrySinkRegistry } = require('../services/telemetrySinks');

describe('Telemetry sink registry', () => {
  test('flush waits for in-flight sink operations', async () => {
    const results = [];
    const registry = new TelemetrySinkRegistry([
      {
        type: 'custom',
        handler: async (event) => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          results.push(event.eventType);
        },
      },
    ]);

    registry.dispatch({ eventType: 'sink.flush.test', entry: {}, visibility: {} });
    await registry.flush();

    expect(results).toEqual(['sink.flush.test']);
  });
});
