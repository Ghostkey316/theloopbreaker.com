const fetch = require('node-fetch');
const PartnerHookRegistry = require('../services/partnerHooks');
const WebhookDeliveryQueue = require('../services/deliveryQueue');

jest.mock('node-fetch');

function createHooks(options = {}) {
  const queue = new WebhookDeliveryQueue({
    fetchImpl: fetch,
    baseDelayMs: 0,
    jitter: 0,
    maxRetries: options.maxRetries || 3,
  });
  return new PartnerHookRegistry({
    telemetry: options.telemetry,
    deliveryQueue: queue,
  });
}

describe('Partner hook registry', () => {
  beforeEach(() => {
    fetch.mockReset();
  });

  it('delivers hook payloads and records telemetry', async () => {
    fetch.mockResolvedValue({ ok: true, status: 200 });
    const record = jest.fn();
    const hooks = createHooks({ telemetry: { record } });
    hooks.subscribe({ partnerId: 'partner', event: 'activation', targetUrl: 'https://example.com' });

    const deliveries = await hooks.onActivation({ walletId: '0xabc' });
    expect(deliveries[0].status).toBe('delivered');
    expect(deliveries[0].attempts).toBe(1);
    expect(record).toHaveBeenCalledWith(
      'partner.hook.delivery',
      expect.objectContaining({ status: 'delivered', partnerId: 'partner' }),
      expect.any(Object)
    );
    expect(fetch).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('walletId'),
      })
    );
  });

  it('skips delivery when no target URL is provided', async () => {
    const hooks = createHooks();
    hooks.subscribe({ partnerId: 'partner', event: 'beliefBreach', targetUrl: '' });
    const deliveries = await hooks.onBeliefBreach({ walletId: '0xabc' });
    expect(deliveries[0].status).toBe('skipped');
    expect(deliveries[0].attempts).toBe(1);
  });

  it('signs payloads when a signing secret is registered', async () => {
    fetch.mockResolvedValue({ ok: true, status: 200 });
    const hooks = createHooks();
    hooks.subscribe({
      partnerId: 'partner',
      event: 'activation',
      targetUrl: 'https://example.com',
      metadata: { signingSecret: 'shhh' },
    });

    await hooks.onActivation({ walletId: '0xdef' });
    const [, options] = fetch.mock.calls[0];
    expect(options.headers['X-Vaultfire-Signature']).toMatch(/^t=\d+,v1=/);
    expect(options.headers['X-Vaultfire-Partner']).toBe('partner');
  });

  it('retries delivery on transient errors', async () => {
    const responses = [
      Promise.resolve({ ok: false, status: 502 }),
      Promise.resolve({ ok: true, status: 200 }),
    ];
    fetch.mockImplementation(() => responses.shift());

    const hooks = createHooks();
    hooks.subscribe({ partnerId: 'partner', event: 'rewardEarned', targetUrl: 'https://retry.test' });
    const deliveries = await hooks.onRewardEarned({ rewardId: 'r1' });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(deliveries[0].status).toBe('delivered');
    expect(deliveries[0].attempts).toBe(2);
  });
});
