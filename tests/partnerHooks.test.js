const fetch = require('node-fetch');
const PartnerHookRegistry = require('../services/partnerHooks');

jest.mock('node-fetch');

describe('Partner hook registry', () => {
  beforeEach(() => {
    fetch.resetMocks();
  });

  it('delivers hook payloads and records telemetry', async () => {
    fetch.mockResolvedValue({ ok: true, status: 200 });
    const record = jest.fn();
    const hooks = new PartnerHookRegistry({ telemetry: { record } });
    hooks.subscribe({ partnerId: 'partner', event: 'activation', targetUrl: 'https://example.com' });

    const deliveries = await hooks.onActivation({ walletId: '0xabc' });
    expect(deliveries[0].status).toBe('delivered');
    expect(record).toHaveBeenCalled();
  });

  it('skips delivery when no target URL is provided', async () => {
    const hooks = new PartnerHookRegistry();
    hooks.subscribe({ partnerId: 'partner', event: 'beliefBreach', targetUrl: '' });
    const deliveries = await hooks.onBeliefBreach({ walletId: '0xabc' });
    expect(deliveries[0].status).toBe('skipped');
  });
});
