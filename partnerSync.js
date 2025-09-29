const express = require('express');
const http = require('http');
const rateLimit = require('express-rate-limit');
const fetch = require('node-fetch');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const { BeliefMirrorEngine } = require('./mirror/engine');
const { determineTier } = require('./mirror/belief-weight');
const { verifyWalletSignature } = require('./utils/walletAuth');

function safeReadJson(filePath, fallback = []) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2));
    return Array.isArray(fallback) ? [...fallback] : { ...fallback };
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Unable to parse ${path.basename(filePath)}: ${error.message}`);
  }
}

function safeWriteJson(filePath, payload) {
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

function createPartnerSyncServer({
  webhookTargets = [],
  telemetryPath,
  votesPath,
} = {}) {
  const app = express();
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  const engine = new BeliefMirrorEngine({ telemetryPath });
  const partnerStore = new Map();
  const resolvedVotesPath = votesPath || path.join(__dirname, 'votes.json');
  if (!fs.existsSync(resolvedVotesPath)) {
    fs.writeFileSync(resolvedVotesPath, JSON.stringify([], null, 2));
  }

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

  function loadVotes() {
    return safeReadJson(resolvedVotesPath, []);
  }

  function appendVote(vote) {
    const votes = loadVotes();
    votes.push(vote);
    safeWriteJson(resolvedVotesPath, votes);
    return votes;
  }

  app.post('/vaultfire/sync-belief', async (req, res) => {
    try {
      const { wallet, signature, message, ens, payload = {} } = req.body || {};
      const verified = verifyWalletSignature({ wallet, signature, message, ens });

      const action = {
        wallet: verified.wallet,
        ens: verified.ens,
        type: 'partnerSync',
        origin: 'partner-sync-interface',
        metrics: {
          loyalty: payload.loyalty ?? payload.loyaltyScore ?? 75,
          ethics: payload.ethics ?? payload.ethicsScore ?? 80,
          frequency: payload.interactionFrequency ?? payload.frequency ?? 60,
          alignment: payload.partnerAlignment ?? payload.alignment ?? 70,
          holdDuration: payload.holdDuration ?? payload.holdDurationDays ?? 40,
        },
      };

      const entry = await engine.processAction(action);
      const partnerRecord = {
        wallet: entry.wallet,
        ens: entry.ens,
        lastSync: entry.timestamp,
        multiplier: entry.multiplier,
        tier: entry.tier,
        status: 'healthy',
        payload,
      };

      partnerStore.set(entry.wallet.toLowerCase(), partnerRecord);

      const responsePayload = {
        ok: true,
        status: 'synced',
        entry,
        tier: entry.tier,
      };

      io.emit('belief-sync', { type: 'partnerSync', entry: partnerRecord });
      await notifyWebhooks({
        event: 'partnerSync',
        payload: partnerRecord,
      });

      res.json(responsePayload);
    } catch (error) {
      res.status(401).json({ error: { message: error.message } });
    }
  });

  app.get('/vaultfire/sync-status', (req, res) => {
    const partners = Array.from(partnerStore.values());
    const summary = buildSummary(partners);
    const mirrorLog = engine.readLog().slice(-50);
    const votes = loadVotes();

    res.json({
      system: partners.length ? 'operational' : 'awaiting_sync',
      summary,
      partners,
      mirrorLog,
      votes,
    });
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
    partnerStore,
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
