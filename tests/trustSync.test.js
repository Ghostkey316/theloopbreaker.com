const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { io } = require('socket.io-client');

const telemetryDir = path.resolve(__dirname, '..', 'logs', 'test-telemetry');
fs.rmSync(telemetryDir, { recursive: true, force: true });
process.env.VAULTFIRE_RC_PATH = path.join(__dirname, 'vaultfirerc.test.json');

const { app, tokenService, identityStoreReady, partnerHooks, telemetryLedger, createServer } = require('../auth/expressExample');
const { ROLES } = require('../auth/roles');

function createToken(overrides = {}) {
  return tokenService.createAccessToken({
    userId: 'trust-sync-tester',
    role: ROLES.PARTNER,
    partnerId: 'trust-partner',
    scopes: ['belief:sync'],
    ...overrides,
  });
}

describe('Trust Sync protocol', () => {
  beforeAll(async () => {
    await identityStoreReady;
  });

  afterAll(() => {
    partnerHooks.removeAllListeners();
  });

  describe('Belief identity linker', () => {
    it('rejects belief scores outside the 0-1 range', async () => {
      const token = createToken();
      const high = await request(app)
        .post('/link-identity')
        .set('Authorization', `Bearer ${token}`)
        .send({ wallet: '0xabc', partnerUserId: 'user-high', beliefScore: 1.2 });
      expect(high.status).toBe(400);
      expect(high.body.error.code).toBe('identity.invalid_belief_score');

      const low = await request(app)
        .post('/link-identity')
        .set('Authorization', `Bearer ${token}`)
        .send({ wallet: '0xabc', partnerUserId: 'user-low', beliefScore: -0.1 });
      expect(low.status).toBe(400);
      expect(low.body.error.code).toBe('identity.invalid_belief_score');
    });

    it('stores anchors at range boundaries and returns them decrypted', async () => {
      const token = createToken();
      const create = await request(app)
        .post('/link-identity')
        .set('Authorization', `Bearer ${token}`)
        .send({ wallet: '0xwallet', partnerUserId: 'user-0', beliefScore: 1 });
      expect(create.status).toBe(200);
      expect(create.body.anchor.beliefScore).toBe(1);

      const fetchRes = await request(app)
        .get('/link-identity')
        .set('Authorization', `Bearer ${token}`)
        .query({ wallet: '0xwallet', partnerUserId: 'user-0' });
      expect(fetchRes.status).toBe(200);
      expect(fetchRes.body.anchor.beliefScore).toBe(1);
    });

    it('returns 404 when anchor is missing', async () => {
      const token = createToken();
      const res = await request(app)
        .get('/link-identity')
        .set('Authorization', `Bearer ${token}`)
        .query({ wallet: '0xmissing', partnerUserId: 'unknown-user' });
      expect(res.status).toBe(404);
    });
  });

  describe('Partner relationship hooks', () => {
    it('fires belief breach hooks and records telemetry', async () => {
      const token = createToken();
      const deliveries = [];
      partnerHooks.subscribe({ event: 'beliefBreach', partnerId: 'trust-partner', targetUrl: '' });
      partnerHooks.on('delivery:beliefBreach', (entry) => deliveries.push(entry));

      const res = await request(app)
        .post('/link-identity')
        .set('Authorization', `Bearer ${token}`)
        .send({ wallet: '0xbreach', partnerUserId: 'user-breach', beliefScore: 0.2 });
      expect(res.status).toBe(200);

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(deliveries.some((entry) => entry.payload.beliefScore === 0.2)).toBe(true);

      const ethicsLog = telemetryLedger.readChannel('ethics');
      expect(ethicsLog.some((entry) => entry.eventType === 'identity.anchor.linked')).toBe(true);
    });

    it('allows partners to subscribe to hook events through the API', async () => {
      const token = createToken();
      const res = await request(app)
        .post('/partner/hooks/subscribe')
        .set('Authorization', `Bearer ${token}`)
        .send({ event: 'activation', targetUrl: '' });
      expect(res.status).toBe(201);
      expect(res.body.subscription.event).toBe('activation');
    });
  });

  describe('Signal Compass streaming', () => {
    it('broadcasts updates over socket connections', async () => {
      const token = createToken();
      const { server, io: socketServer } = createServer();
      await new Promise((resolve) => server.listen(0, resolve));
      const port = server.address().port;

      const client = io(`http://localhost:${port}`, {
        transports: ['websocket'],
        auth: { token },
      });

      const updatePromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('No signal update received')), 2000);
        client.on('signal-compass:update', (snapshot) => {
          if (snapshot.incoming.some((entry) => entry.walletId === '0xstream')) {
            clearTimeout(timeout);
            resolve(snapshot);
          }
        });
      });

      await request(app)
        .post('/link-identity')
        .set('Authorization', `Bearer ${token}`)
        .send({ wallet: '0xstream', partnerUserId: 'user-stream', beliefScore: 0.9 });

      const snapshot = await updatePromise;
      expect(snapshot.intentFrequency).toBeDefined();

      client.disconnect();
      socketServer.close();
      await new Promise((resolve) => server.close(resolve));
    });

    it('provides snapshots via the API', async () => {
      const token = createToken();
      const snapshot = await request(app)
        .get('/signal-compass/state')
        .set('Authorization', `Bearer ${token}`);
      expect(snapshot.status).toBe(200);
      expect(Array.isArray(snapshot.body.incoming)).toBe(true);
    });
  });

  describe('Authentication flows', () => {
    it('issues and refreshes access tokens', async () => {
      const login = await request(app)
        .post('/auth/login')
        .send({ userId: 'refresh-user', partnerId: 'trust-partner', role: ROLES.PARTNER });
      expect(login.status).toBe(200);
      const refresh = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: login.body.refreshToken });
      expect(refresh.status).toBe(200);
      expect(refresh.body.accessToken).toBeDefined();
    });

    it('rejects invalid login payloads', async () => {
      const res = await request(app).post('/auth/login').send({});
      expect(res.status).toBe(400);
    });
  });

  describe('Mirror agent integration', () => {
    it('interprets belief payloads through the mirror route', async () => {
      const token = tokenService.createAccessToken({
        userId: 'contributor',
        role: ROLES.CONTRIBUTOR,
        partnerId: 'trust-partner',
      });

      const res = await request(app)
        .post('/vaultfire/mirror')
        .set('Authorization', `Bearer ${token}`)
        .send({ walletId: '0xmirror', beliefScore: 0.76, partnerUserId: 'mirror-user', narrative: 'Aligned mission.' });
      expect(res.status).toBe(202);
      expect(res.body.summary.recommendedAction).toBeDefined();
    });
  });
});
