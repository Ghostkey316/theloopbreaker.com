const fs = require('fs');
const os = require('os');
const path = require('path');

const { SignalRelay } = require('../services/signalRelay');

describe('SignalRelay', () => {
  let queueDir;
  let queuePath;
  let currentTime;
  let fetchMock;

  beforeEach(() => {
    queueDir = fs.mkdtempSync(path.join(os.tmpdir(), 'signal-relay-'));
    queuePath = path.join(queueDir, 'queue.json');
    currentTime = 1_000;
    fetchMock = jest.fn();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    fs.rmSync(queueDir, { recursive: true, force: true });
    console.warn.mockRestore();
  });

  function createRelay(overrides = {}) {
    return new SignalRelay({
      fetchImpl: fetchMock,
      queueFilePath: queuePath,
      nowFn: () => currentTime,
      randomFn: () => 0,
      baseDelayMs: 1_000,
      circuitBreaker: { failureThreshold: 2, cooldownMs: 5_000 },
      retryOptions: {
        scheduler: (cb) => cb(),
        baseDelayMs: 100,
        maxDelayMs: 5_000,
        randomFn: () => 0,
      },
      ...overrides,
    });
  }

  it('queues failed dispatches with exponential backoff and circuit snapshots', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });
    const relay = createRelay();

    await relay.dispatch(
      { id: 'alpha', endpoint: 'https://invalid.example' },
      { hello: 'world' },
      { telemetryId: 'telemetry-1' }
    );
    let queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
    expect(queue).toHaveLength(1);
    expect(queue[0].attempts).toBe(relay.retryHandler.maxAttempts);
    expect(queue[0].circuitState.state).toBe('closed');
    expect(new Date(queue[0].nextAttemptAt).getTime()).toBeGreaterThan(currentTime);

    currentTime = 2_000;
    await relay.dispatch({ id: 'alpha', endpoint: 'https://invalid.example' }, { hello: 'world' });
    queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
    expect(queue).toHaveLength(2);
    const latest = queue[1];
    expect(latest.circuitState.state).toBe('open');
    const expectedDelay = Math.min(
      relay.maxDelayMs,
      relay.baseDelayMs * relay.backoffFactor ** latest.attempts
    );
    expect(new Date(latest.nextAttemptAt).getTime()).toBe(2_000 + expectedDelay);
  });

  it('retries queued jobs and clears them on success', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });
    const relay = createRelay();

    await relay.dispatch({ id: 'beta', endpoint: 'https://invalid.example' }, { ping: true });
    let queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
    expect(queue).toHaveLength(1);

    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    currentTime = Date.parse(queue[0].nextAttemptAt) + 1;
    const outcome = await relay.retry({ now: currentTime });
    expect(outcome.attempted).toBe(1);
    expect(outcome.delivered).toBe(1);
    queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
    expect(queue).toHaveLength(0);
  });

  it('reschedules retries when circuit breaker remains open', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });
    const relay = createRelay();

    await relay.dispatch({ id: 'gamma', endpoint: 'https://invalid.example' }, { ping: true });
    currentTime += 1_000;
    await relay.dispatch({ id: 'gamma', endpoint: 'https://invalid.example' }, { ping: true });

    fetchMock.mockResolvedValue({ ok: false, status: 503 });
    currentTime += 1_000;
    let queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
    queue = queue.map((job) => ({ ...job, nextAttemptAt: new Date(currentTime - 100).toISOString() }));
    fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2));

    const result = await relay.retry({ now: currentTime });
    expect(result.attempted).toBe(0);
    const updated = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
    expect(new Date(updated[0].nextAttemptAt).getTime()).toBeGreaterThan(currentTime);
  });

  it('attempts immediate retries before queueing when failures are transient', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    const relay = createRelay({
      retryOptions: {
        scheduler: (cb) => cb(),
        baseDelayMs: 10,
        maxDelayMs: 100,
        randomFn: () => 0,
        maxAttempts: 3,
      },
    });

    const result = await relay.dispatch(
      { id: 'theta', endpoint: 'https://sometimes.example' },
      { ping: 'pong' },
      { telemetryId: 'telemetry-9' }
    );

    expect(result.status).toBe('delivered');
    expect(result.attempts).toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fs.existsSync(queuePath)).toBe(false);
  });
});
