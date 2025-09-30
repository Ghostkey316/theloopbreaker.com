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
  });
  const voteRepository = new VoteRepository({ filePath: resolvedVotesPath });
  const webhookQueue = deliveryQueue || new WebhookDeliveryQueue();
  const webhookSubscriptions = webhookTargets
    .map((target, index) => normalizeWebhookTarget(target, index))
    .filter((entry) => entry && entry.targetUrl);
  const handshakeSessions = new Map();
  const sessionTtl = Math.max(60 * 1000, sessionTtlMs || DEFAULT_SESSION_TTL_MS);
  const governanceThresholds = {
    multiplierCritical:
      governance.multiplierCritical ?? GOVERNANCE_THRESHOLDS.multiplierCritical,
    summaryWarning: governance.summaryWarning ?? GOVERNANCE_THRESHOLDS.summaryWarning,
  };

  const securityLogOptions = {
    tags: ['security'],
    visibility: { partner: false, ethics: true, audit: true },
  };

  function recordTelemetry(event, payload, options) {
    if (!resolvedTelemetry || typeof resolvedTelemetry.record !== 'function') {
      return;
    }
    resolvedTelemetry.record(event, payload, options);
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
      securityPosture.refresh();
      const snapshot = securityPosture.getHandshakeSnapshot();
      res.json({
        ...snapshot,
        sessionTtlSeconds: Math.floor(sessionTtl / 1000),
      });
    } catch (error) {
      res.status(500).json({ error: { message: error.message } });
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
      res.json({
        ok: true,
        status: 'acknowledged',
        session,
        posture: securityPosture.getHandshakeSnapshot().posture,
        rotation: {
          secretId: session.secretId,
          expiresAt: session.expiresAt,
        },
      });
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

      io.emit('belief-sync', { type: 'partnerSync', entry: partnerRecord });
      await notifyWebhooks('partnerSync', partnerRecord);

      const partners = await partnerStorage.listPartners();
      const summary = buildSummary(partners);
      const governanceAlerts = [];

      if (entry.multiplier < governanceThresholds.multiplierCritical) {
        governanceAlerts.push({
          type: 'multiplier.floor',
          wallet: entry.wallet,
          multiplier: entry.multiplier,
          tier: entry.tier,
          severity: 'critical',
        });
      }

      if (summary.beliefScore < governanceThresholds.summaryWarning) {
        governanceAlerts.push({
          type: 'summary.drift',
          beliefScore: summary.beliefScore,
          totalPartners: summary.totalPartners,
          severity: 'warning',
        });
      }

      if (governanceAlerts.length) {
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
        io.emit('governance-alert', governanceAlerts);
        responsePayload.governance = { alerts: governanceAlerts };
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

  app.get('/vaultfire/sync-status', async (req, res) => {
    try {
      const partners = await partnerStorage.listPartners();
      const summary = buildSummary(partners);
      const mirrorLog = engine.readRecentEntries(50);
      const votes = await loadVotes();

      res.json({
        system: partners.length ? 'operational' : 'awaiting_sync',
        summary,
        partners,
        mirrorLog,
        votes,
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
      io.removeAllListeners();
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
  };
}

if (require.main === module) {
  const webhookTargets = process.env.PARTNER_SYNC_WEBHOOKS
    ? process.env.PARTNER_SYNC_WEBHOOKS.split(',').map((target) => target.trim()).filter(Boolean)
    : [];

  const server = createPartnerSyncServer({ webhookTargets });
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
