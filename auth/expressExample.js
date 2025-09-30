const express = require('express');
const bodyParser = require('body-parser');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const TokenService = require('./tokenService');
const { createAuthMiddleware } = require('./authMiddleware');
const { ROLES } = require('./roles');
const createEthicsGuard = require('../middleware/ethicsGuard');
const MultiTierTelemetryLedger = require('../services/telemetryLedger');
const EncryptedIdentityStore = require('../services/identityStore');
const SignalCompass = require('../services/signalCompass');
const PartnerHookRegistry = require('../services/partnerHooks');
const AIMirrorAgent = require('../services/aiMirrorAgent');
const { createFingerprint } = require('../services/originFingerprint');
const { loadTrustSyncConfig } = require('../config/trustSyncConfig');
const TrustSyncVerifier = require('../services/trustSyncVerifier');
const RewardStreamPlanner = require('../services/rewardStreamPlanner');

const app = express();
const port = process.env.PORT || 4002;

app.use(bodyParser.json());

const tokenService = new TokenService();
const ethicsGuard = createEthicsGuard();
const trustConfig = loadTrustSyncConfig();
const telemetryLedger = new MultiTierTelemetryLedger(trustConfig.telemetry);
const identityStore = new EncryptedIdentityStore(trustConfig.identityStore, telemetryLedger);
const identityStoreReady = identityStore.init();
const signalCompass = new SignalCompass({ telemetry: telemetryLedger, ...(trustConfig.signalCompass || {}) });
const partnerHooks = new PartnerHookRegistry({ telemetry: telemetryLedger });
const mirrorAgent = new AIMirrorAgent({ telemetry: telemetryLedger, ...(trustConfig.mirror || {}) });
const trustVerifier = new TrustSyncVerifier({
  telemetry: telemetryLedger,
  remote: trustConfig.verification?.remote || null,
});
const rewardStreamPlanner = new RewardStreamPlanner({ telemetry: telemetryLedger });
const BELIEF_BREACH_THRESHOLD = trustConfig.identityStore?.breachThreshold ?? 0.35;

if (Array.isArray(trustConfig.hooks?.defaultSubscriptions)) {
  trustConfig.hooks.defaultSubscriptions.forEach((subscription) => {
    try {
      partnerHooks.subscribe({
        partnerId: subscription.partnerId || 'config-partner',
        event: subscription.event,
        targetUrl: subscription.targetUrl,
        metadata: { ...subscription.metadata, source: 'config-bootstrap' },
      });
    } catch (error) {
      console.warn('Failed to register default hook', error.message);
    }
  });
}

const swaggerPath = path.join(__dirname, '../docs/vaultfire-openapi.yaml');
let swaggerDocument = {};
try {
  swaggerDocument = YAML.load(swaggerPath);
} catch (err) {
  console.warn('Unable to load OpenAPI spec at startup:', err.message);
}

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    beliefEngine: 'synchronized',
    trustPhase: 'sync',
    identity: {
      useWalletAsIdentity: trustConfig.useWalletAsIdentity,
      rejectExternalID: trustConfig.rejectExternalID,
      pseudonymousMode: trustConfig.pseudonymousMode,
    },
    telemetryMode: trustConfig.telemetryMode,
  });
});

app.post('/auth/login', (req, res) => {
  const { wallet, ens, role = ROLES.PARTNER, partnerId = 'demo-partner', scopes = [] } = req.body || {};
  if (!wallet) {
    return res.status(400).json({ error: { code: 'auth.invalid_payload', message: 'wallet is required' } });
  }
  if (!validateWallet(wallet)) {
    return res.status(400).json({ error: { code: 'auth.invalid_wallet', message: 'wallet must be a valid address' } });
  }
  if (trustConfig.identity?.rejectExternalID && req.body?.userId && req.body.userId !== wallet) {
    return res.status(400).json({
      error: {
        code: 'auth.identity_rejected',
        message: 'External identifiers are not accepted. Use wallet or ENS only.',
      },
    });
  }

  const normalizedWallet = wallet.toLowerCase();
  const ensAlias = ens ? ens.toLowerCase() : null;

  try {
    const accessToken = tokenService.createAccessToken({ wallet: normalizedWallet, ens: ensAlias, role, partnerId, scopes });
    const refreshToken = tokenService.createRefreshToken({ wallet: normalizedWallet, ens: ensAlias, role, partnerId, scopes });
    telemetryLedger.record('auth.login', { wallet: normalizedWallet, partnerId, role, ens: ensAlias }, {
      tags: ['auth'],
      visibility: { partner: false, ethics: true, audit: true },
    });

    return res.status(200).json({
      accessToken,
      refreshToken: refreshToken.token,
      refreshExpiresAt: new Date(refreshToken.expiresAt).toISOString(),
    });
  } catch (error) {
    return res.status(400).json({ error: { code: 'auth.invalid_role', message: error.message } });
  }
});

app.post('/auth/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: { code: 'auth.invalid_payload', message: 'refreshToken is required' } });
  }

  const response = tokenService.refreshAccessToken(refreshToken);
  if (!response) {
    return res.status(401).json({ error: { code: 'auth.unauthorized', message: 'Refresh token expired or invalid' } });
  }

  telemetryLedger.record('auth.refresh', { refreshTokenId: refreshToken.slice(0, 12) }, {
    tags: ['auth'],
    visibility: { partner: false, ethics: true, audit: true },
  });

  return res.status(200).json(response);
});

app.post(
  '/vaultfire/activate',
  ...createAuthMiddleware({ requiredRoles: [ROLES.PARTNER, ROLES.ADMIN], tokenService }),
  ethicsGuard,
  (req, res) => {
    const { walletId, activationChannel } = req.body || {};
    if (!walletId || !activationChannel) {
      return res.status(400).json({
        error: { code: 'activation.invalid_payload', message: 'walletId and activationChannel are required' },
      });
    }
    if (!validateWallet(walletId)) {
      return res.status(400).json({
        error: { code: 'activation.invalid_wallet', message: 'walletId must be a valid address' },
      });
    }

    const normalizedWallet = walletId.toLowerCase();

    const response = {
      status: 'activated',
      walletId: normalizedWallet,
      tierLevel: 'flame',
      activatedAt: new Date().toISOString(),
      modules: [
        { moduleId: 'belief-alignment', state: 'initialized' },
        { moduleId: 'loyalty-yield', state: 'queued' },
      ],
    };

    telemetryLedger.record('vaultfire.activation', { walletId: normalizedWallet, activationChannel, partnerId: req.user.partnerId }, {
      tags: ['activation'],
      visibility: { partner: true, ethics: true, audit: true },
    });

    partnerHooks
      .onActivation({ walletId: normalizedWallet, activationChannel, partnerId: req.user.partnerId })
      .catch((error) => console.warn('Activation hook delivery error', error));

    return res.status(201).json(response);
  }
);

app.get(
  '/vaultfire/rewards/:walletId',
  ...createAuthMiddleware({ requiredRoles: [ROLES.PARTNER, ROLES.ADMIN], tokenService }),
  ethicsGuard,
  (req, res) => {
    const currentYield = { apr: 6.4, multiplier: 1.15, tierLevel: 'flame' };
    const streamPreview = rewardStreamPlanner.previewStream(req.params.walletId, {
      partnerId: req.user.partnerId,
      currentYield,
    });
    const response = {
      walletId: req.params.walletId,
      currentYield,
      signalsReviewed: true,
      streamPreview,
    };

    telemetryLedger.record('vaultfire.rewards.view', { walletId: req.params.walletId, partnerId: req.user.partnerId }, {
      tags: ['rewards'],
      visibility: { partner: true, ethics: false, audit: true },
    });

    partnerHooks
      .onRewardEarned({ walletId: req.params.walletId, partnerId: req.user.partnerId, yield: response.currentYield })
      .catch((error) => console.warn('Reward hook delivery error', error));

    return res.json(response);
  }
);

function validateBeliefScore(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'beliefScore must be a number';
  }
  if (value < 0 || value > 1) {
    return 'beliefScore must be between 0 and 1';
  }
  return null;
}

function validateWallet(value) {
  if (typeof value !== 'string' || !/^0x[a-fA-F0-9]{4,}$/.test(value)) {
    return false;
  }
  return true;
}

function evaluateBreach(score) {
  return score < BELIEF_BREACH_THRESHOLD;
}

app.get(
  '/link-wallet',
  ...createAuthMiddleware({ requiredRoles: [ROLES.PARTNER, ROLES.ADMIN], tokenService }),
  ethicsGuard,
  async (req, res) => {
    const { wallet, ens } = req.query || {};
    if (!wallet) {
      return res.status(400).json({
        error: {
          code: 'wallet.invalid_query',
          message: 'wallet query parameter is required',
        },
      });
    }
    if (!validateWallet(wallet)) {
      return res.status(400).json({
        error: {
          code: 'wallet.invalid_query',
          message: 'wallet must be a valid address',
        },
      });
    }

    await identityStoreReady;
    const anchor = await identityStore.getWalletAnchor({ wallet, ensAlias: ens });
    if (!anchor) {
      return res.status(404).json({ error: { code: 'wallet.not_found', message: 'Wallet anchor not found' } });
    }
    const fingerprint = createFingerprint({ wallet: anchor.wallet, ens: anchor.ensAlias });
    const anchorWithOrigin = { ...anchor, originFingerprint: fingerprint.fingerprint };
    return res.json({ anchor: anchorWithOrigin });
  }
);

app.post(
  '/link-wallet',
  ...createAuthMiddleware({ requiredRoles: [ROLES.PARTNER, ROLES.ADMIN], tokenService }),
  ethicsGuard,
  async (req, res) => {
    const { wallet, ens, beliefScore, metadata = {} } = req.body || {};
    if (!wallet) {
      return res.status(400).json({
        error: { code: 'wallet.invalid_payload', message: 'wallet is required' },
      });
    }
    if (!validateWallet(wallet)) {
      return res.status(400).json({ error: { code: 'wallet.invalid_payload', message: 'wallet must be a valid address' } });
    }
    if (trustConfig.identity?.rejectExternalID && metadata?.externalId) {
      return res.status(400).json({
        error: {
          code: 'wallet.identity_rejected',
          message: 'External identifiers are not accepted. Remove externalId metadata.',
        },
      });
    }
    const validationError = validateBeliefScore(beliefScore);
    if (validationError) {
      return res.status(400).json({ error: { code: 'wallet.invalid_belief_score', message: validationError } });
    }

    await identityStoreReady;
    const anchor = await identityStore.linkWallet({ wallet, ensAlias: ens, beliefScore, metadata });

    const fingerprint = createFingerprint({ wallet: anchor.wallet, ens: anchor.ensAlias });
    const snapshot = signalCompass.recordPayload({
      walletId: anchor.wallet,
      ensAlias: anchor.ensAlias,
      beliefScore,
      originFingerprint: fingerprint.fingerprint,
      intents: metadata?.intents || [],
      ethicsFlags: metadata?.ethicsFlags || [],
      metadata: { ...metadata, source: 'link-wallet' },
    });

    if (evaluateBreach(beliefScore)) {
      partnerHooks
        .onBeliefBreach({ walletId: anchor.wallet, ensAlias: anchor.ensAlias, beliefScore, partnerId: req.user.partnerId })
        .catch((error) => console.warn('Belief breach hook error', error));
    }

    const anchorWithOrigin = { ...anchor, originFingerprint: fingerprint.fingerprint };
    const verification = await trustVerifier.verifyAnchor(anchorWithOrigin, {
      partnerId: req.user.partnerId,
      wallet,
      event: 'link-wallet',
    });

    if (verification.status === 'rejected') {
      return res.status(409).json({
        error: {
          code: 'wallet.verification_rejected',
          message: 'Remote trust verifier rejected anchor attestation.',
        },
        verification,
      });
    }

    return res.status(200).json({ anchor: anchorWithOrigin, signalCompass: snapshot, verification });
  }
);

app.post(
  '/partner/hooks/subscribe',
  ...createAuthMiddleware({ requiredRoles: [ROLES.PARTNER, ROLES.ADMIN], tokenService }),
  ethicsGuard,
  (req, res) => {
    const { event, targetUrl, metadata = {} } = req.body || {};
    if (!event) {
      return res.status(400).json({ error: { code: 'hooks.invalid_payload', message: 'event is required' } });
    }
    try {
      const subscription = partnerHooks.subscribe({
        partnerId: req.user.partnerId,
        event,
        targetUrl,
        metadata,
      });
      return res.status(201).json({ subscription });
    } catch (error) {
      return res.status(400).json({ error: { code: 'hooks.invalid_event', message: error.message } });
    }
  }
);

app.get(
  '/signal-compass/state',
  ...createAuthMiddleware({ requiredRoles: [ROLES.PARTNER, ROLES.ADMIN], tokenService }),
  ethicsGuard,
  (req, res) => {
    return res.json(signalCompass.snapshot());
  }
);

app.post(
  '/vaultfire/mirror',
  ...createAuthMiddleware({ requiredRoles: [ROLES.CONTRIBUTOR, ROLES.PARTNER], tokenService }),
  ethicsGuard,
  async (req, res) => {
    try {
      const parsed = mirrorAgent.parseWebhook(req.body);
      if (!validateWallet(parsed.walletId)) {
        throw new Error('walletId must be a valid address');
      }
      const summary = mirrorAgent.interpretBeliefSignal(parsed);
      const ensAlias = req.body.ens || req.body.ensAlias || null;
      const fingerprint = createFingerprint({
        wallet: parsed.walletId,
        ens: ensAlias ? ensAlias.toLowerCase() : null,
      });
      signalCompass.recordPayload({
        walletId: parsed.walletId,
        ensAlias: ensAlias ? ensAlias.toLowerCase() : null,
        beliefScore: parsed.beliefScore,
        originFingerprint: fingerprint.fingerprint,
        intents: summary.intents,
        ethicsFlags: summary.ethicsFlags,
        metadata: { source: 'mirror', tone: summary.toneLabel },
      });

      telemetryLedger.record('vaultfire.mirror.accepted', {
        walletId: parsed.walletId,
        partnerId: req.user.partnerId,
        beliefScore: parsed.beliefScore,
        intents: summary.intents,
      });

      await identityStoreReady;
      await identityStore.linkWallet({
        wallet: parsed.walletId,
        ensAlias,
        beliefScore: parsed.beliefScore,
        metadata: { source: 'mirror-route', originFingerprint: fingerprint.fingerprint },
      });

      if (evaluateBreach(parsed.beliefScore)) {
        partnerHooks
          .onBeliefBreach({
            walletId: parsed.walletId,
            ensAlias: ensAlias ? ensAlias.toLowerCase() : req.user.ens || null,
            beliefScore: parsed.beliefScore,
            partnerId: req.user.partnerId,
          })
          .catch((error) => console.warn('Belief breach hook error', error));
      }

      const response = {
        status: 'mirroring',
        walletId: parsed.walletId,
        alignmentState: 'under_review',
        beliefScore: parsed.beliefScore,
        summary,
      };
      await Promise.resolve(mirrorAgent.emitSummary(summary));
      return res.status(202).json(response);
    } catch (error) {
      return res.status(400).json({ error: { code: 'mirror.invalid_payload', message: error.message } });
    }
  }
);

function createServer({ corsOrigins = ['*'] } = {}) {
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: corsOrigins,
      methods: ['GET', 'POST'],
    },
  });
  signalCompass.bindSocket(io);
  return { server, io };
}

if (require.main === module) {
  const { server } = createServer();
  server.listen(port, () => {
    console.log(`Vaultfire trust sync API listening on port ${port}`);
  });
}

module.exports = {
  app,
  tokenService,
  telemetryLedger,
  signalCompass,
  partnerHooks,
  identityStore,
  identityStoreReady,
  mirrorAgent,
  createServer,
};
