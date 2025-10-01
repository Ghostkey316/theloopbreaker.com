const request = require('supertest');

jest.mock('../utils/notifyPartner', () => ({
  notifyPartner: jest.fn().mockResolvedValue({}),
  registerPartnerWebhook: jest.fn(),
  getPartnerStatus: jest.fn().mockReturnValue({ healthy: true, alerts: [], environment: 'test' }),
  getRecentAlerts: jest.fn().mockReturnValue([]),
}));

const { buildIdentityResolver, defaultFallback } = require('../services/identity-resolver');
const { notifyPartner, registerPartnerWebhook, getPartnerStatus } = require('../utils/notifyPartner');

class StubStore {
  constructor(records = {}) {
    this.records = records;
  }

  async init() {}

  async getWallet(walletId) {
    if (walletId === 'explode') {
      throw new Error('boom');
    }
    return this.records[walletId] || null;
  }
}

describe('identity resolver service', () => {
  it('returns wallet metadata from the store', async () => {
    const stub = new StubStore({
      'wallet.test': { wallet: 'wallet.test', score: 92, lastSeen: '2025-09-30T18:44Z' },
    });
    const { app } = await buildIdentityResolver({ store: stub });
    const response = await request(app).get('/resolve/wallet.test');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ wallet: 'wallet.test', score: 92, lastSeen: '2025-09-30T18:44Z' });
  });

  it('falls back to default resolver when wallet is missing', async () => {
    const fallback = jest.fn((walletId) => ({ ...defaultFallback(walletId), source: 'fallback-test' }));
    const { app } = await buildIdentityResolver({ store: new StubStore({}), fallbackResolver: fallback });
    const response = await request(app).get('/resolve/unknown.wallet');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ wallet: 'unknown.wallet', score: 0, status: 'not_found', source: 'fallback-test' });
    expect(fallback).toHaveBeenCalledWith('unknown.wallet');
  });

  it('reports resolution errors via notifyPartner', async () => {
    const { app } = await buildIdentityResolver({ store: new StubStore({ explode: null }) });
    const response = await request(app).get('/resolve/explode');
    expect(response.status).toBe(500);
    expect(notifyPartner).toHaveBeenCalledWith(
      expect.objectContaining({ module: 'identity', type: 'error', message: expect.stringContaining('explode') })
    );
  });

  it('exposes status with partner metadata', async () => {
    const { app } = await buildIdentityResolver({ store: new StubStore({}) });
    const response = await request(app).get('/status');
    expect(response.status).toBe(200);
    expect(getPartnerStatus).toHaveBeenCalled();
    expect(response.body).toMatchObject({ service: 'identity-resolver', healthy: true, environment: 'test' });
  });

  it('registers webhooks through the notify utility', async () => {
    const { app } = await buildIdentityResolver({ store: new StubStore({}) });
    registerPartnerWebhook.mockReturnValue({ partnerId: 'demo', url: 'https://example.com' });
    const response = await request(app)
      .post('/webhooks')
      .send({ partnerId: 'demo', url: 'https://example.com' });
    expect(response.status).toBe(201);
    expect(registerPartnerWebhook).toHaveBeenCalledWith({ partnerId: 'demo', url: 'https://example.com', headers: undefined });
  });
});
