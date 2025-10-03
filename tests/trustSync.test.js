const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { io } = require('socket.io-client');

const telemetryDir = path.resolve(__dirname, '..', 'logs', 'test-telemetry');
fs.rmSync(telemetryDir, { recursive: true, force: true });
process.env.VAULTFIRE_RC_PATH = path.join(__dirname, 'vaultfirerc.test.json');

const { app, tokenService, identityStoreReady, partnerHooks, telemetryLedger, createServer } = require('../auth/expressExample');
const { ROLES } = require('../auth/roles');

const WALLET_PARTNER = '0xcccccccccccccccccccccccccccccccccccccccc';
const WALLET_SAMPLE = '0xabcdabcdabcdabcdabcdabcdabcdabcdabcdabcd';
const WALLET_SECONDARY = '0x1111111111111111111111111111111111111111';
const WALLET_BREACH = '0xbeefbeefbeefbeefbeefbeefbeefbeefbeefbeef';
const WALLET_STREAM = '0xfeedfeedfeedfeedfeedfeedfeedfeedfeedfeed';
const WALLET_REFRESH = '0xcafecafecafecafecafecafecafecafecafecafe';
const WALLET_MIRROR = '0xdeaddeaddeaddeaddeaddeaddeaddeaddeadbeef';
const WALLET_CENTRAL = '0x2222222222222222222222222222222222222222';
const WALLET_CONTRIBUTOR = '0x3333333333333333333333333333333333333333';

function createToken(overrides = {}) {
  return tokenService.createAccessToken({
    wallet: WALLET_PARTNER,
    role: ROLES.PARTNER,
    partnerId: 'trust-partner',
    scopes: ['belief:sync'],
    ...overrides,
  });
}

function createAdminToken(overrides = {}) {
  return tokenService.createAccessToken({
    wallet: WALLET_PARTNER,
    role: ROLES.ADMIN,
    partnerId: 'trust-partner',
    scopes: ['belief:sync'],
    ...overrides,
  });
}

function createContributorToken(overrides = {}) {
  return tokenService.createAccessToken({
    wallet: WALLET_CONTRIBUTOR,
    role: ROLES.CONTRIBUTOR,
    partnerId: 'trust-partner',
    scopes: ['belief:sync'],
    ...overrides,
  });
}

function mockVerification(result = { accepted: true }, { status = 200, attestation } = {}) {
  fetchMock.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => result,
  });
  fetchMock.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () =>
      attestation || {
        status: 'accepted',
        attestation: { signature: '0xattest', signedAt: new Date().toISOString() },
      },
  });
}

describe('Trust Sync protocol', () => {
  beforeAll(async () => {
    await identityStoreReady;
  });

  afterAll(() => {
    partnerHooks.removeAllListeners();
  });

  describe('Wallet linker', () => {
    it('rejects belief scores outside the 0-1 range', async () => {
      const token = createToken();
      const high = await request(app)
        .post('/link-wallet')
        .set('Authorization', `Bearer ${token}`)
        .send({ wallet: WALLET_SAMPLE, beliefScore: 1.2 });
      expect(high.status).toBe(400);
      expect(high.body.error.code).toBe('wallet.invalid_belief_score');

      const low = await request(app)
        .post('/link-wallet')
        .set('Authorization', `Bearer ${token}`)
        .send({ wallet: WALLET_SAMPLE, beliefScore: -0.1 });
      expect(low.status).toBe(400);
      expect(low.body.error.code).toBe('wallet.invalid_belief_score');
    });

    it('stores anchors at range boundaries and returns them decrypted', async () => {
      const token = createToken();
      mockVerification();
      const create = await request(app)
        .post('/link-wallet')
        .set('Authorization', `Bearer ${token}`)
        .send({ wallet: WALLET_SAMPLE, beliefScore: 1 });
      expect(create.status).toBe(200);
      expect(create.body.anchor.beliefScore).toBe(1);
      expect(create.body.anchor.ensAlias).toBeNull();
      expect(create.body.anchor.originFingerprint).toHaveLength(64);
      expect(['accepted', 'pending_attestation']).toContain(create.body.verification.status);

      const fetchRes = await request(app)
        .get('/link-wallet')
        .set('Authorization', `Bearer ${token}`)
        .query({ wallet: WALLET_SAMPLE });
      expect(fetchRes.status).toBe(200);
      expect(fetchRes.body.anchor.beliefScore).toBe(1);
      expect(fetchRes.body.anchor.originFingerprint).toHaveLength(64);
    });

    it('returns 404 when anchor is missing', async () => {
      const token = createToken();
      const res = await request(app)
        .get('/link-wallet')
        .set('Authorization', `Bearer ${token}`)
        .query({ wallet: WALLET_SECONDARY });
      expect(res.status).toBe(404);
    });

    it('rejects payloads containing external identifiers', async () => {
      const token = createToken();
      const res = await request(app)
        .post('/link-wallet')
        .set('Authorization', `Bearer ${token}`)
        .send({ wallet: WALLET_SAMPLE, beliefScore: 0.5, metadata: { externalId: '1234' } });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('wallet.identity_rejected');
    });
  });

  it('exposes wallet-first identity policy via health check', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.identity).toMatchObject({
      useWalletAsIdentity: true,
      rejectExternalID: true,
      pseudonymousMode: 'always',
    });
    expect(res.body.telemetryMode).toBe('wallet-anonymous');
  });

  describe('Partner relationship hooks', () => {
    it('fires belief breach hooks and records telemetry', async () => {
      const token = createToken();
      const deliveries = [];
      partnerHooks.subscribe({
        event: 'beliefBreach',
        partnerId: 'trust-partner',
        targetUrl: 'https://hooks.vaultfire.test/breach',
      });
      partnerHooks.on('delivery:beliefBreach', (entry) => deliveries.push(entry));

      mockVerification();
      const res = await request(app)
        .post('/link-wallet')
        .set('Authorization', `Bearer ${token}`)
        .send({ wallet: WALLET_BREACH, ens: 'breach.eth', beliefScore: 0.2 });
      expect(res.status).toBe(200);
      expect(['accepted', 'pending_attestation']).toContain(res.body.verification.status);

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(deliveries.some((entry) => entry.payload.beliefScore === 0.2)).toBe(true);
      expect(deliveries.some((entry) => entry.payload.ensAlias === 'breach.eth')).toBe(true);

      const ethicsLog = telemetryLedger.readChannel('ethics');
      expect(ethicsLog.some((entry) => entry.eventType === 'identity.anchor.linked')).toBe(true);
    });

    it('allows partners to subscribe to hook events through the API', async () => {
      const token = createToken();
      const res = await request(app)
        .post('/partner/hooks/subscribe')
        .set('Authorization', `Bearer ${token}`)
        .send({ event: 'activation', targetUrl: 'https://hooks.vaultfire.test/activation' });
      expect(res.status).toBe(201);
      expect(res.body.subscription.event).toBe('activation');
    });
  });

  it('previews reward stream wiring when viewing rewards', async () => {
    const token = createToken();
    const res = await request(app)
      .get(`/vaultfire/rewards/${WALLET_REFRESH}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.streamPreview).toMatchObject({
      status: expect.any(String),
      multiplier: expect.any(Object),
    });
    expect(res.body.streamPreview.multiplier.value).toBeGreaterThan(0);
    expect(res.body.hybridCompliance).toBeDefined();
    expect(res.body.currentYield).toHaveProperty('apr');
  });

  it('exposes deployment status and allows admin toggles', async () => {
    const status = await request(app).get('/deployment/status');
    expect(status.status).toBe(200);
    expect(status.body.indicator).toHaveProperty('label');
    const adminToken = createAdminToken();
    const toggle = await request(app)
      .post('/deployment/mode')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ mode: 'live' });
    expect(toggle.status).toBe(200);
    expect(toggle.body.status.mode).toBe('live');
    expect(toggle.body.status.indicator.label).toBe('LIVE');
    await request(app)
      .post('/deployment/mode')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ mode: 'simulated' });
  });

  it('ingests realtime telemetry using obfuscated payloads', async () => {
    const token = createToken();
    const res = await request(app)
      .post('/telemetry/realtime')
      .set('Authorization', `Bearer ${token}`)
      .send({ events: [{ walletId: WALLET_STREAM, beliefScore: 0.66 }], channel: 'telemetry.mock' });
    expect(res.status).toBe(202);
    expect(res.body.ingestion.totalAccepted).toBe(1);
    expect(res.body.ingestion.accepted[0].payload.walletHash).toHaveLength(64);
  });

  it('provides a trust map narrative for partners', async () => {
    const token = createToken();
    mockVerification();
    await request(app)
      .post('/link-wallet')
      .set('Authorization', `Bearer ${token}`)
      .send({ wallet: WALLET_CENTRAL, beliefScore: 0.84, metadata: { intents: ['soul-linkers'] } });
    const res = await request(app)
      .get('/trust-map')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.map.nodes).toBeDefined();
    expect(Object.keys(res.body.map.nodes).length).toBeGreaterThan(0);
    expect(res.body.narrative.nodes.length).toBeGreaterThan(0);
    expect(res.body.narrative.nodes[0]).toHaveProperty('enterpriseIntent');
  });

  it('records belief action signatures for onchain simulation', async () => {
    const contributorToken = createContributorToken();
    const res = await request(app)
      .post('/belief/actions/sign')
      .set('Authorization', `Bearer ${contributorToken}`)
      .send({ walletId: WALLET_CONTRIBUTOR, action: 'mission.completed', signature: '0xdeadbeef' });
    expect(res.status).toBe(202);
    expect(res.body.ledgerEntry.walletHash).toHaveLength(64);
    expect(res.body.status).toBe('queued');
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
          if (snapshot.incoming.some((entry) => entry.walletId === WALLET_STREAM)) {
            clearTimeout(timeout);
            resolve(snapshot);
          }
        });
      });

      mockVerification();
      await request(app)
        .post('/link-wallet')
        .set('Authorization', `Bearer ${token}`)
        .send({ wallet: WALLET_STREAM, beliefScore: 0.9 });

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
        .send({ wallet: WALLET_REFRESH, partnerId: 'trust-partner', role: ROLES.PARTNER, ens: 'refresh.eth' });
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

    it('rejects attempts to login with external IDs', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ userId: 'centralized-user', wallet: WALLET_CENTRAL, partnerId: 'trust-partner' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('auth.identity_rejected');
    });
  });

  describe('Mirror agent integration', () => {
    it('interprets belief payloads through the mirror route', async () => {
      const token = tokenService.createAccessToken({
        wallet: WALLET_CONTRIBUTOR,
        role: ROLES.CONTRIBUTOR,
        partnerId: 'trust-partner',
      });

      mockVerification();
      const res = await request(app)
        .post('/vaultfire/mirror')
        .set('Authorization', `Bearer ${token}`)
        .send({ walletId: WALLET_MIRROR, beliefScore: 0.76, ens: 'mirror.eth', narrative: 'Aligned mission.' });
      expect(res.status).toBe(202);
      expect(res.body.summary.recommendedAction).toBeDefined();
    });
  });

  it('rejects anchors when remote verification denies the request', async () => {
    const token = createToken();
    mockVerification({ accepted: false, reason: 'mismatch' });
    const res = await request(app)
      .post('/link-wallet')
      .set('Authorization', `Bearer ${token}`)
      .send({ wallet: WALLET_SECONDARY, beliefScore: 0.8 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('wallet.verification_rejected');
    expect(res.body.verification.status).toBe('rejected');
  });
});
