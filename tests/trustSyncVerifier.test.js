const TrustSyncVerifier = require('../services/trustSyncVerifier');

describe('TrustSyncVerifier', () => {
  const anchor = { wallet: '0xabc', beliefScore: 0.8, originFingerprint: 'fingerprint' };
  const contextBase = { partnerId: 'partner-1', event: 'link-wallet', telemetryId: 'telemetry-1' };

  it('skips verification when remote endpoint is disabled', async () => {
    const verifier = new TrustSyncVerifier();
    const result = await verifier.verifyAnchor(anchor, contextBase);
    expect(result.status).toBe('skipped');
  });

  it('rejects anchors with timestamps outside the allowed skew', async () => {
    const verifier = new TrustSyncVerifier({
      remote: { endpoint: 'https://example.com/verify', fetchImpl: jest.fn() },
    });
    const result = await verifier.verifyAnchor(anchor, {
      ...contextBase,
      timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    });
    expect(result.status).toBe('rejected');
    expect(result.reason).toBe('timestamp_out_of_range');
  });

  it('detects replay attempts within the replay window', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ accepted: true }) });
    const verifier = new TrustSyncVerifier({
      remote: { endpoint: 'https://example.com/verify', fetchImpl, replayWindowMs: 60_000 },
    });
    const timestamp = new Date().toISOString();
    const first = await verifier.verifyAnchor(anchor, { ...contextBase, timestamp });
    expect(first.status).toBe('accepted');
    const second = await verifier.verifyAnchor(anchor, { ...contextBase, timestamp });
    expect(second.status).toBe('rejected');
    expect(second.reason).toBe('replay_detected');
  });

  it('returns checksum metadata when remote verification fails', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 503 });
    const verifier = new TrustSyncVerifier({
      remote: { endpoint: 'https://example.com/verify', fetchImpl },
    });
    const result = await verifier.verifyAnchor(anchor, contextBase);
    expect(result.status).toBe('pending');
    expect(result.checksum).toMatch(/^[a-f0-9]{64}$/);
  });

  it('surfaces checksum on network errors and defers verification', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('offline'));
    const verifier = new TrustSyncVerifier({
      remote: { endpoint: 'https://example.com/verify', fetchImpl },
    });
    const result = await verifier.verifyAnchor(anchor, contextBase);
    expect(result.status).toBe('deferred');
    expect(result.checksum).toMatch(/^[a-f0-9]{64}$/);
  });
});
