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
    expect(result.digest).toMatch(/^[a-f0-9]{64}$/);
  });

  it('surfaces checksum on network errors and defers verification', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('offline'));
    const verifier = new TrustSyncVerifier({
      remote: { endpoint: 'https://example.com/verify', fetchImpl },
    });
    const result = await verifier.verifyAnchor(anchor, contextBase);
    expect(result.status).toBe('deferred');
    expect(result.digest).toMatch(/^[a-f0-9]{64}$/);
  });

  it('requests external attestation when endpoint is configured', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ accepted: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ signature: '0xabc', signedAt: new Date().toISOString() }) });
    const verifier = new TrustSyncVerifier({
      remote: { endpoint: 'https://example.com/verify', fetchImpl },
      externalValidationEndpoint: 'https://example.com/attest',
    });
    const result = await verifier.verifyAnchor(anchor, contextBase);
    expect(result.status).toBe('accepted');
    expect(result.attestation.signature).toBe('0xabc');
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      'https://example.com/attest',
      expect.objectContaining({ body: expect.stringContaining('"digest"') })
    );
  });

  it('caches attestation results to avoid redundant network calls', async () => {
    const timestamp = new Date().toISOString();
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ accepted: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ signature: '0x123', signedAt: timestamp }) });
    const verifier = new TrustSyncVerifier({
      remote: { endpoint: 'https://example.com/verify', fetchImpl },
      externalValidationEndpoint: 'https://example.com/attest',
    });

    const first = await verifier.verifyAnchor(anchor, { ...contextBase, timestamp });
    expect(first.status).toBe('accepted');
    const second = await verifier.verifyAnchor(anchor, { ...contextBase, timestamp });
    expect(second.status).toBe('accepted');
    expect(second.attestationSource).toBe('cache');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('marks verification as pending when attestation fails after remote acceptance', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ accepted: true }) })
      .mockResolvedValueOnce({ ok: false, status: 500 });
    const verifier = new TrustSyncVerifier({
      remote: { endpoint: 'https://example.com/verify', fetchImpl },
      externalValidationEndpoint: 'https://example.com/attest',
    });
    const result = await verifier.verifyAnchor(anchor, contextBase);
    expect(result.status).toBe('pending_attestation');
    expect(result.reason).toBe('external_attestation_http_500');
  });
});
