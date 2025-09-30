const express = require('express');
const http = require('http');
const rateLimit = require('express-rate-limit');
const fetch = require('node-fetch');
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

function createPartnerSyncServer({
  webhookTargets = [],
  telemetryPath,
  votesPath,
  storageOptions = {},
} = {}) {
  const app = express();
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

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

  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use(limiter);
  app.use(express.json({ limit: '1mb' }));

  async function notifyWebhooks(payload) {
    if (!webhookTargets.length) {
      return;
    }

    await Promise.all(
      webhookTargets.map(async (target) => {
        try {
          await fetch(target, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        } catch (error) {
          console.warn(`Webhook notification to ${target} failed: ${error.message}`);
        }
      })
    );
  }

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
      const { wallet, signature, message, ens, payload = {} } = req.body || {};
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
      await notifyWebhooks({
        event: 'partnerSync',
        payload: partnerRecord,
      });

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
      httpServer.close(() => resolve());
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
