const crypto = require('crypto');
const express = require('express');
const http = require('http');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const path = require('path');
const { BeliefMirrorEngine } = require('./mirror/engine');
const { determineTier } = require('./mirror/belief-weight');
const { verifyWalletSignature } = require('./utils/walletAuth');
const { createPartnerStorage } = require('./services/partnerStorage');
const { VoteRepository } = require('./services/voteRepository');
const { assertWalletOnlyData } = require('./utils/identityGuards');
const {
  ValidationError,
  extractMetrics,
  sanitizeScoringConfig,
} = require('./utils/scoringValidator');
const SecurityPostureManager = require('./services/securityPosture');
const WebhookDeliveryQueue = require('./services/deliveryQueue');
const { ROLES, hasRequiredRole } = require('./auth/roles');
const { createAuthMiddleware } = require('./auth/authMiddleware');
const { sendSignedJson } = require('./utils/responseSigner');
const { SecretsManager } = require('./services/secretsManager');
const HandshakeJWTAuthority = require('./services/handshake/jwtAuthority');
const ApiKeyGate = require('./services/handshake/apiKeyGate');
const GovernanceEnforcer = require('./services/handshake/governanceEnforcer');
const { loadGovernanceConfig } = require('./governance/governance-core');
const SocketRelay = require('./services/handshake/socketRelay');

const PROTOCOL_MANIFEST_PATH = path.join(__dirname, 'manifest.json');
const DEFAULT_MANIFEST_METADATA = {
  name: 'Vaultfire Protocol',
  semanticVersion: '0.0.0',
  releaseDate: null,
  ethicsTags: ['ethics-anchor'],
  scopeTags: ['pilot'],
};

const { createManifestFailover } = require('./services/manifestFailover');

function sanitizeVotePayload(vote) {
  assertWalletOnlyData(vote, { context: 'vote' });
  return {
    proposalId: vote.proposalId,
    choice: vote.choice,
    wallet: vote.wallet,
    ens: vote.ens || null,
    weight: vote.weight,
    tier: vote.tier,
    timestamp: vote.timestamp,
    messageDigest: vote.messageDigest,
  };
}

const DEFAULT_SESSION_TTL_MS = 15 * 60 * 1000;
const GOVERNANCE_THRESHOLDS = {
  multiplierCritical: 1,
  summaryWarning: 1.05,
};

function ensureTelemetry(telemetry) {
  if (telemetry && typeof telemetry.record === 'function') {
    return telemetry;
  }
  return { record: () => {} };
}

function normalizeWebhookTarget(target, index) {
  if (!target) {
    return null;
  }
  if (typeof target === 'string') {
    return {
      targetUrl: target,
      partnerId: `webhook-${index + 1}`,
      signingSecret: null,
      metadata: {},
    };
  }
  if (typeof target === 'object') {
    return {
      targetUrl: target.targetUrl || target.url || target.endpoint || null,
      partnerId: target.partnerId || target.id || `webhook-${index + 1}`,
      signingSecret: target.signingSecret || target.secret || target.webhookSecret || null,
      metadata: target.metadata || {},
    };
  }
  return null;
}

function createPartnerSyncServer({
  webhookTargets = [],
  telemetryPath,
  votesPath,
  storageOptions = {},
  telemetry,
  securityPostureManager,
  deliveryQueue,
  sessionTtlMs = DEFAULT_SESSION_TTL_MS,
  governance = {},
} = {}) {
  const app = express();
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  const resolvedTelemetry = ensureTelemetry(telemetry);
  const manifestFailover = createManifestFailover({
    manifestPath: PROTOCOL_MANIFEST_PATH,
    defaults: DEFAULT_MANIFEST_METADATA,
    telemetry: resolvedTelemetry,
  });
  const socketRelay = new SocketRelay({ io, telemetry: resolvedTelemetry });
  const secretsManager = storageOptions.secretsManager || new SecretsManager({});
  const jwtAuthority = new HandshakeJWTAuthority({ secretsManager, telemetry: resolvedTelemetry });
  const discoveryTokenService = jwtAuthority.tokenService;
  const apiKeyGate = new ApiKeyGate({ secretsManager, telemetry: resolvedTelemetry });
  const securityPosture =
    securityPostureManager || new SecurityPostureManager({ telemetry: resolvedTelemetry });
  const engine = new BeliefMirrorEngine({ telemetryPath });
  const resolvedVotesPath = votesPath || path.join(__dirname, 'votes.json');
  const partnerStorage = createPartnerStorage({
    sqlite: {
      dbPath: path.join(__dirname, 'data', 'partner-sync.db'),
      ...(storageOptions.sqlite || {}),
    },
    adapter: storageOptions.adapter,
    provider: storageOptions.provider,
    readOnly: storageOptions.readOnly,
    localforage: storageOptions.localforage,
    postgres: storageOptions.postgres,
    supabase: storageOptions.supabase,
    telemetry: resolvedTelemetry,
  });
  const voteRepository = new VoteRepository({ filePath: resolvedVotesPath });
  const webhookQueue = deliveryQueue || new WebhookDeliveryQueue();
  const webhookSubscriptions = webhookTargets
    .map((target, index) => normalizeWebhookTarget(target, index))
    .filter((entry) => entry && entry.targetUrl);
  const handshakeSessions = new Map();
  const sessionTtl = Math.max(60 * 1000, sessionTtlMs || DEFAULT_SESSION_TTL_MS);
  const governanceAudit = governance.auditPassed ?? false;
  const governanceEnforcer = new GovernanceEnforcer({
    telemetry: resolvedTelemetry,
    thresholds: {
      multiplierCritical:
        governance.multiplierCritical ?? GOVERNANCE_THRESHOLDS.multiplierCritical,
      summaryWarning: governance.summaryWarning ?? GOVERNANCE_THRESHOLDS.summaryWarning,
    },
    audit: {
      passed: governanceAudit,
    },
  });
  socketRelay.register({ jwtAuthority, apiKeyGate });

  const handshakeRequiredRoles = [ROLES.PARTNER, ROLES.ADMIN];
  const [adminAuthRateLimiter, adminAuthGuard] = createAuthMiddleware({
    requiredRoles: [ROLES.ADMIN],
    tokenService: discoveryTokenService,
  });

  const securityLogOptions = {
    tags: ['security'],
    visibility: { partner: false, ethics: true, audit: true },
  };

  function recordTelemetry(event, payload, options) {
    if (!resolvedTelemetry || typeof resolvedTelemetry.record !== 'function') {
      return;
    }
    const nextOptions = options ? { ...options } : {};
    const existingConfig = nextOptions.config ? { ...nextOptions.config } : {};
    if (typeof existingConfig.auditPassed !== 'boolean') {
      existingConfig.auditPassed = governanceAudit;
    }
    nextOptions.config = existingConfig;
    resolvedTelemetry.record(event, payload, nextOptions);
  }

  function authError(message, code = 'auth.unauthorized', statusCode = 401) {
    const error = new Error(message);
    error.code = code;
    error.statusCode = statusCode;
    return error;
  }

  function extractBearerToken(req) {
    const header = req.headers.authorization;
    if (!header) {
      return null;
    }
    const [scheme, value] = header.split(' ');
    if (scheme !== 'Bearer' || !value) {
      return null;
    }
    return value;
  }

  function verifyBearer(req, { requiredRoles = handshakeRequiredRoles } = {}) {
    const token = extractBearerToken(req);
    if (!token) {
      return null;
    }

    const result = jwtAuthority.verify(token, { tags: ['http'] });
    if (!result.valid) {
      throw authError('Invalid bearer token for handshake discovery.', 'auth.unauthorized', 401);
    }
    if (!hasRequiredRole(result.payload.role, requiredRoles)) {
      throw authError('Insufficient role access for this resource.', 'auth.forbidden', 403);
    }
    return result.payload;
  }

  function verifyApiKey(req) {
    const result = apiKeyGate.verify(req);
    if (!result.valid) {
      if (result.reason === 'no_keys_configured') {
        return null;
      }
      throw authError('Invalid API key for handshake discovery.', 'auth.unauthorized', 401);
    }
    return { type: 'api-key', key: result.key };
  }

  function requireDiscoveryAuth(req) {
    const bearer = verifyBearer(req, {});
    if (bearer) {
      req.discoveryAuth = { type: 'bearer', user: bearer };
      return req.discoveryAuth;
    }

    const apiKeyAuth = verifyApiKey(req);
    if (apiKeyAuth) {
      req.discoveryAuth = apiKeyAuth;
      return apiKeyAuth;
    }

    throw authError('Missing authentication for handshake discovery. Provide a bearer token or API key.');
  }

  function cleanupExpiredSessions(now = Date.now()) {
    for (const [token, session] of handshakeSessions.entries()) {
      const expiry = Date.parse(session.expiresAt);
      if (Number.isFinite(expiry) && expiry <= now) {
        handshakeSessions.delete(token);
      }
    }
  }

  function createHandshakeSession({ wallet, partnerId, secret, nonce, timestamp }) {
    cleanupExpiredSessions();
    const sessionId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
    const now = Date.now();
    const secretExpiry = secret?.expiresAt ? Date.parse(secret.expiresAt) : null;
    const ttlDeadline = now + sessionTtl;
    let expiresAt = ttlDeadline;
    if (Number.isFinite(secretExpiry) && secretExpiry > now) {
      expiresAt = Math.min(secretExpiry, ttlDeadline);
    }
    const session = {
      token: sessionId,
      wallet,
      partnerId: partnerId || null,
      issuedAt: new Date(now).toISOString(),
      expiresAt: new Date(expiresAt).toISOString(),
      secretId: secret?.id || null,
      nonce: nonce || null,
      timestamp: timestamp || null,
    };
    handshakeSessions.set(sessionId, session);
    return session;
  }

  function requireHandshakeSession({ wallet, token }) {
    if (!token) {
      const error = new Error('Handshake session required');
      error.statusCode = 401;
      throw error;
    }
    cleanupExpiredSessions();
    const session = handshakeSessions.get(token);
    if (!session) {
      const error = new Error('Handshake session invalid or expired');
      error.statusCode = 401;
      throw error;
    }
    if (session.wallet !== wallet.toLowerCase()) {
      const error = new Error('Handshake session wallet mismatch');
      error.statusCode = 401;
      throw error;
    }
    return session;
  }

  async function notifyWebhooks(event, payload) {
    if (!webhookSubscriptions.length) {
      return [];
    }
    const deliveries = await Promise.all(
      webhookSubscriptions.map((subscription) =>
        webhookQueue.enqueue({
          event,
          payload,
          partnerId: subscription.partnerId,
          targetUrl: subscription.targetUrl,
          signingSecret: subscription.signingSecret,
          metadata: subscription.metadata,
        })
      )
    );
    return deliveries;
  }

  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use(limiter);
  app.use(express.json({ limit: '1mb' }));

  app.get('/vaultfire/handshake', (req, res) => {
    try {
      requireDiscoveryAuth(req);
      securityPosture.refresh();
      const snapshot = securityPosture.getHandshakeSnapshot();
      const response = {
        status: snapshot.status,
        requiresHandshake: snapshot.requiresHandshake,
        posture: snapshot.posture,
        issuedAt: snapshot.issuedAt,
        sessionTtlSeconds: Math.floor(sessionTtl / 1000),
      };
      sendSignedJson(res, response, { securityPosture });
    } catch (error) {
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({
        error: {
          code: error.code || 'handshake.discovery.error',
          message: error.message,
        },
      });
    }
  });

  app.post('/vaultfire/handshake', (req, res) => {
    const { wallet, partnerId = null, nonce, timestamp, digest, secretId } = req.body || {};
    const normalizedWallet = typeof wallet === 'string' ? wallet.toLowerCase() : null;

    if (!normalizedWallet) {
      return res.status(400).json({ error: { message: 'wallet is required' } });
    }

    try {
      securityPosture.refresh();
      const handshakeRequired = securityPosture.requiresHandshake();
      const handshakePayload =
        handshakeRequired || digest || secretId
          ? { nonce, timestamp, digest, secretId }
          : null;
      const verification = securityPosture.assertHandshakeSecret(handshakePayload, {
        wallet: normalizedWallet,
      });
      const session = createHandshakeSession({
        wallet: normalizedWallet,
        partnerId,
        secret: verification.secret,
        nonce,
        timestamp,
      });
      recordTelemetry(
        'security.handshake.accepted',
        {
          wallet: normalizedWallet,
          partnerId,
          sessionId: session.token,
          secretId: session.secretId,
        },
        securityLogOptions
      );
      sendSignedJson(
        res,
        {
          ok: true,
          status: 'acknowledged',
          session,
          posture: securityPosture.getHandshakeSnapshot().posture,
          requiresHandshake: securityPosture.requiresHandshake(),
          issuedAt: new Date().toISOString(),
        },
        { securityPosture }
      );
    } catch (error) {
      recordTelemetry(
        'security.handshake.rejected',
        {
          wallet: normalizedWallet,
          partnerId,
          reason: error.message,
        },
        securityLogOptions
      );
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json({ error: { message: error.message } });
    }
  });

  app.get('/vaultfire/admin/rotation-status', adminAuthRateLimiter, adminAuthGuard, (req, res) => {
    try {
      securityPosture.refresh();
      const rotation = securityPosture.getRotationStatus();
      sendSignedJson(
        res,
        {
          ok: true,
          rotation,
          issuedAt: new Date().toISOString(),
        },
        { securityPosture }
      );
    } catch (error) {
      res.status(500).json({ error: { message: error.message } });
    }
  });

  function buildSummary(partners) {
    if (!partners.length) {
      return {
        beliefScore: 1,
        tier: 'Observer',
        totalPartners: 0,
        healthyPartners: 0,
      };
    }

    const totalMultiplier = partners.reduce((acc, partner) => acc + partner.multiplier, 0);
    const beliefScore = Number((totalMultiplier / partners.length).toFixed(4));
    return {
      beliefScore,
      tier: determineTier(beliefScore),
      totalPartners: partners.length,
      healthyPartners: partners.filter((partner) => partner.status === 'healthy').length,
    };
  }

  async function loadVotes() {
    return voteRepository.loadVotes();
  }

  async function appendVote(vote) {
    const sanitized = sanitizeVotePayload(vote);
    await voteRepository.appendVote(sanitized);
    return voteRepository.loadVotes();
  }

  app.post('/vaultfire/sync-belief', async (req, res) => {
    try {
      const { wallet, signature, message, ens, payload = {}, sessionToken, nonce } = req.body || {};
      if (typeof wallet !== 'string') {
        throw new Error('Wallet address is required');
      }
      const normalizedWallet = wallet.toLowerCase();
      const handshakeRequired = securityPosture.requiresHandshake();
      let activeSession = null;
      if (handshakeRequired || sessionToken) {
        activeSession = requireHandshakeSession({ wallet: normalizedWallet, token: sessionToken });
        if (activeSession.nonce && nonce && nonce !== activeSession.nonce) {
          const error = new Error('Handshake nonce mismatch');
          error.statusCode = 401;
          throw error;
        }
      }
      if (activeSession) {
        activeSession.lastUsedAt = new Date().toISOString();
      }
      assertWalletOnlyData(payload, { context: 'payload' });
      const verified = verifyWalletSignature({ wallet, signature, message, ens });
      const metrics = extractMetrics(payload);
      const scoringConfig = sanitizeScoringConfig(payload.scoringConfig);

      const action = {
        wallet: verified.wallet,
        ens: verified.ens,
        type: 'partnerSync',
        origin: 'partner-sync-interface',
        metrics,
        scoringConfig,
      };

      const entry = await engine.processAction(action);
      const partnerRecord = {
        wallet: entry.wallet,
        ens: entry.ens,
        lastSync: entry.timestamp,
        multiplier: entry.multiplier,
        tier: entry.tier,
        status: 'healthy',
        payload: {
          metrics,
          scoringConfig,
        },
        configOverrides: Boolean(entry.configOverrides),
      };

      await partnerStorage.savePartner(partnerRecord);

      const responsePayload = {
        ok: true,
        status: 'synced',
        entry,
        tier: entry.tier,
        overridesDetected: Boolean(entry.configOverrides),
      };

      socketRelay.emit('belief-sync', { type: 'partnerSync', entry: partnerRecord });
      await notifyWebhooks('partnerSync', partnerRecord);

      const partners = await partnerStorage.listPartners();
      const summary = buildSummary(partners);
      const enforcement = governanceEnforcer.assess({
        multiplier: entry.multiplier,
        summaryScore: summary.beliefScore,
      });

      if (enforcement.alerts.length) {
        const governanceAlerts = enforcement.alerts.map((alert) => {
          if (alert.type === 'multiplier.floor') {
            return {
              type: 'multiplier.floor',
              wallet: entry.wallet,
              multiplier: entry.multiplier,
              tier: entry.tier,
              severity: 'critical',
            };
          }
          if (alert.type === 'summary.threshold') {
            return {
              type: 'summary.drift',
              beliefScore: summary.beliefScore,
              totalPartners: summary.totalPartners,
              severity: 'warning',
            };
          }
          return alert;
        });

        governanceAlerts.forEach((alert) => {
          recordTelemetry(
            'governance.alert',
            alert,
            {
              tags: ['governance'],
              visibility: { partner: false, ethics: true, audit: true },
            }
          );
        });
        await Promise.all(governanceAlerts.map((alert) => notifyWebhooks('governance.alert', alert)));
        socketRelay.emit('governance-alert', governanceAlerts);
        responsePayload.governance = { alerts: governanceAlerts, status: enforcement.status };
      }

      res.json(responsePayload);
    } catch (error) {
      const statusCode = error.statusCode || (error.message && error.message.includes('Signature') ? 401 : 400);
      res.status(statusCode).json({
        error: {
          message: error.message,
          details: error instanceof ValidationError ? error.details : undefined,
        },
      });
    }
  });

  app.get('/manifest.json', (req, res) => {
    const manifest = manifestFailover.snapshot();
    res.json(manifest);
  });

  app.get('/vaultfire/sync-status', async (req, res) => {
    try {
      const partners = await partnerStorage.listPartners();
      const summary = buildSummary(partners);
      const mirrorLog = engine.readRecentEntries(50);
      const votes = await loadVotes();

      const manifest = manifestFailover.snapshot();
      res.json({
        system: partners.length ? 'operational' : 'awaiting_sync',
        summary,
        partners,
        mirrorLog,
        votes,
        manifest,
        ethics: { tags: manifest.ethicsTags },
        scope: { tags: manifest.scopeTags },
      });
    } catch (error) {
      res.status(500).json({ error: { message: error.message } });
    }
  });

  app.get('/status', async (req, res) => {
    try {
      const partners = await partnerStorage.listPartners();
      const summary = buildSummary(partners);
      const manifest = manifestFailover.snapshot();
      res.json({
        system: partners.length ? 'operational' : 'awaiting_sync',
        summary,
        manifest,
        ethics: { tags: manifest.ethicsTags },
        scope: { tags: manifest.scopeTags },
        partners: partners.map((partner) => ({
          wallet: partner.wallet,
          ens: partner.ens,
          tier: partner.tier,
          multiplier: partner.multiplier,
          lastSync: partner.lastSync,
          status: partner.status,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: { message: error.message } });
    }
  });

  app.get('/public/status-feed.json', async (req, res) => {
    try {
      const partners = await partnerStorage.listPartners();
      const summary = buildSummary(partners);
      const recentEntries = engine.readRecentEntries(20).map((entry) => ({
        wallet: entry.wallet,
        ens: entry.ens,
        multiplier: entry.multiplier,
        tier: entry.tier,
        timestamp: entry.timestamp,
      }));

      res.setHeader('Cache-Control', 'no-store');
      res.json({
        generatedAt: new Date().toISOString(),
        summary,
        partners: partners.map((partner) => ({
          wallet: partner.wallet,
          ens: partner.ens,
          multiplier: partner.multiplier,
          tier: partner.tier,
          lastSync: partner.lastSync,
          status: partner.status,
        })),
        recentEntries,
      });
    } catch (error) {
      res.status(500).json({ error: { message: error.message } });
    }
  });

  const start = ({ port = 4050 } = {}) =>
    new Promise((resolve) => {
      httpServer.listen(port, () => {
        console.log(`Vaultfire partner sync listening on ${port}`);
        resolve({ port });
      });
    });

  const stop = () =>
    new Promise((resolve) => {
      socketRelay.close();
      io.removeAllListeners();
      manifestFailover.close();
      httpServer.close(async () => {
        try {
          await webhookQueue.flush();
        } catch (error) {
          console.warn('Failed to flush webhook queue', error.message);
        }
        handshakeSessions.clear();
        resolve();
      });
    });

  return {
    app,
    io,
    httpServer,
    start,
    stop,
    appendVote,
    loadVotes,
    partnerStorage,
    engine,
    manifestFailover,
  };
}

if (require.main === module) {
  const webhookTargets = process.env.PARTNER_SYNC_WEBHOOKS
    ? process.env.PARTNER_SYNC_WEBHOOKS.split(',').map((target) => target.trim()).filter(Boolean)
    : [];

  const { config: governanceConfig } = loadGovernanceConfig({ argv: process.argv });
  const server = createPartnerSyncServer({ webhookTargets, governance: governanceConfig });
  const port = process.env.PARTNER_SYNC_PORT ? Number(process.env.PARTNER_SYNC_PORT) : 4050;
  server
    .start({ port })
    .catch((error) => {
      console.error('Failed to start partner sync server', error);
      process.exitCode = 1;
    });
}

module.exports = {
  createPartnerSyncServer,
};
