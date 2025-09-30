const fs = require('fs');
const path = require('path');
const { BeliefMirrorEngine } = require('../mirror/engine');

describe('Belief mirror engine sinks', () => {
  const telemetryPath = path.join(__dirname, '..', 'logs', 'mirror-test.json');

  beforeEach(() => {
    fs.rmSync(path.dirname(telemetryPath), { recursive: true, force: true });
  });

  it('dispatches entries to sink registry', async () => {
    const sinkHandler = jest.fn();
    const engine = new BeliefMirrorEngine({
      telemetryPath,
      sinks: [{ type: 'custom', handler: sinkHandler }],
    });

    await engine.appendEntry({ wallet: '0xabc', timestamp: new Date().toISOString() });
    await engine.flushExternal();

    expect(sinkHandler).toHaveBeenCalledWith(expect.objectContaining({ channel: 'belief.mirror' }));
  });
});
