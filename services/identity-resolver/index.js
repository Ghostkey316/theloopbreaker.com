const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');
const { MongoWalletStore } = require('./store');
const { logger, createVaultfireLogger } = require('../logging');
const { notifyPartner, registerPartnerWebhook, getPartnerStatus } = require('../../utils/notifyPartner');

function defaultFallback(walletId) {
  return {
    wallet: walletId,
    score: 0,
    lastSeen: null,
    status: 'not_found',
  };
}

async function buildIdentityResolver({
  store,
  fallbackResolver = defaultFallback,
  logCategory = 'identity-resolver',
} = {}) {
  const serviceLogger = logCategory === 'identity-resolver' ? logger : createVaultfireLogger(logCategory);
  const walletStore = store || new MongoWalletStore();
  await walletStore.init();

  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(bodyParser.json());
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: 120,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  app.get('/resolve/:walletId', async (req, res) => {
    const walletId = req.params.walletId?.toLowerCase();
    if (!walletId) {
      res.status(400).json({ error: 'walletId is required' });
      return;
    }

    try {
      const entry = await walletStore.getWallet(walletId);
      if (!entry) {
        serviceLogger.warn('identity.resolve.miss', { walletId });
        const fallback = fallbackResolver(walletId);
        res.json({ ...fallback, wallet: walletId, source: fallback.source || 'fallback' });
        return;
      }
      const payload = {
        wallet: entry.wallet,
        score: entry.score,
        lastSeen: entry.lastSeen,
        updatedAt: entry.updatedAt,
      };
      res.json(payload);
    } catch (error) {
      serviceLogger.error('identity.resolve.error', { walletId, error: error.message });
      await notifyPartner({
        type: 'error',
        module: 'identity',
        message: `Wallet resolution failed for ${walletId}`,
        details: { error: error.message },
      });
      res.status(500).json({ error: 'Resolution failed' });
    }
  });

  app.get('/status', (req, res) => {
    const status = getPartnerStatus();
    res.json({
      service: 'identity-resolver',
      uptime: process.uptime(),
      ...status,
    });
  });

  app.post('/alerts', async (req, res) => {
    try {
      const alert = await notifyPartner(req.body || {});
      res.status(202).json(alert);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/webhooks', (req, res) => {
    const { partnerId, url, headers } = req.body || {};
    try {
      const record = registerPartnerWebhook({ partnerId, url, headers });
      res.status(201).json(record);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  return { app, store: walletStore };
}

async function startIdentityResolver(options = {}) {
  const { app, store } = await buildIdentityResolver(options);
  const port = options.port || process.env.PORT || 4800;
  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      logger.info('identity.resolver.started', { port });
      resolve({ server, store });
    });
  });
}

module.exports = {
  buildIdentityResolver,
  startIdentityResolver,
  defaultFallback,
};
