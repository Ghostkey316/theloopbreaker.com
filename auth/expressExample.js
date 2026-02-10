const express = require('express');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');
const TokenService = require('./tokenService');
const { createAuthMiddleware } = require('./authMiddleware');
const { RedisNonceStore, createErc8128Middleware, createAuthOrErc8128Middleware } = require('./erc8128');
const { buildProvidersFromEnv } = require('../services/erc8128Providers');
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
const { createOpsMetrics } = require('../services/opsMetrics');
const { DeploymentModeController } = require('../services/deploymentMode');
const RealtimeTelemetryIngestor = require('../services/realtimeTelemetry');
const BeliefActionLedger = require('../services/beliefActionLedger');
const ReputationYieldBridge = require('../services/reputationYieldBridge');
const PartnerRevenueBridge = require('../services/revenueBridge');
const BeliefInterpreterModule = require('../services/interpreterModule');

const app = express();
const port = process.env.PORT || 4002;
const DEFAULT_ALLOWED_ORIGINS = (process.env.VAULTFIRE_ALLOWED_ORIGINS ||
  'https://vaultfire.app,http://localhost:3000').split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.disable('x-powered-by');
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
// Capture raw body bytes for ERC-8128 content-digest verification.
app.use(
  bodyParser.json({
    limit: '1mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

const tokenService = new TokenService();
const ethicsGuard = createEthicsGuard();

// ERC-8128 setup (optional). If RPC URLs are not configured, ERC-8128 will be unavailable.
const erc8128Providers = buildProvidersFromEnv();
const erc8128NonceStore = process.env.VAULTFIRE_REDIS_URL
  ? new RedisNonceStore({ url: process.env.VAULTFIRE_REDIS_URL })
  : null;
const erc8128Middleware = erc8128NonceStore
  ? createErc8128Middleware({
      requiredRole: ROLES.PARTNER,
      nonceStore: erc8128NonceStore,
      providersByChainId: erc8128Providers,
      policy: { skewSec: 60, maxWindowSec: 60 },
    })
  : null;
const trustConfig = loadTrustSyncConfig();
const telemetryLedger = new MultiTierTelemetryLedger(trustConfig.telemetry);
const deploymentMode = new DeploymentModeController({
  config: {
    ...trustConfig.deployment,
    partnerReady: trustConfig.deployment?.partnerReady || trustConfig.vaultfire?.partnerReady,
    hybridCompliance: trustConfig.deployment?.hybridCompliance || trustConfig.rewards?.hybridCompliance,
  },
  telemetry: telemetryLedger,
});
const identityStore = new EncryptedIdentityStore(trustConfig.identityStore, telemetryLedger);
const identityStoreReady = identityStore.init();
const interpreterModule = new BeliefInterpreterModule({
  telemetry: telemetryLedger,
  terminology: trustConfig.interpreter?.terminology,
});
const signalCompass = new SignalCompass({
  telemetry: telemetryLedger,
  ...(trustConfig.signalCompass || {}),
  interpreter: interpreterModule,
  deployment: deploymentMode,
});
const realtimeTelemetry = new RealtimeTelemetryIngestor({
  ledger: telemetryLedger,
  obfuscate: trustConfig.telemetry?.obfuscate ?? true,
});
const beliefActionLedger = new BeliefActionLedger({ telemetry: telemetryLedger });
const opsMetrics = createOpsMetrics();
const partnerHooks = new PartnerHookRegistry({ telemetry: telemetryLedger, metrics: opsMetrics });
const mirrorAgent = new AIMirrorAgent({ telemetry: telemetryLedger, ...(trustConfig.mirror || {}) });
const trustVerifier = new TrustSyncVerifier({
  telemetry: telemetryLedger,
  remote: trustConfig.verification?.remote || null,
  externalValidationEndpoint: trustConfig.verification?.externalValidationEndpoint || null,
});
const rewardStreamPlanner = new RewardStreamPlanner({ telemetry: telemetryLedger, config: trustConfig.rewards });
const reputationBridge = new ReputationYieldBridge({
  telemetry: telemetryLedger,
  thresholds: trustConfig.rewards?.reputationThresholds,
  baseApr: trustConfig.rewards?.baseApr,
});
const revenueBridge = new PartnerRevenueBridge({
  telemetry: telemetryLedger,
  providers: trustConfig.rewards?.partnerRevenueProviders,
});
const BELIEF_BREACH_THRESHOLD = trustConfig.identityStore?.breachThreshold ?? 0.35;
const SANDBOX_CONFIG_PATH = path.join(__dirname, '../configs/module_sandbox.json');
const BELIEF_SANDBOX_LOG = path.join(__dirname, '../logs/belief-sandbox.json');

deploymentMode.on('mode', (status) => {
  signalCompass.emit('mode', status);
});
deploymentMode.on('hybridCompliance', () => {
  signalCompass.emit('trust-map:update', signalCompass.trustMap());
});
deploymentMode.on('semantics', () => {
  signalCompass.emit('trust-map:update', signalCompass.trustMap());
});

function loadSandboxConfig() {
  try {
    const raw = fs.readFileSync(SANDBOX_CONFIG_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    return {};
  }
}

function readSandboxLog(limit = 200) {
  try {
    const raw = fs.readFileSync(BELIEF_SANDBOX_LOG, 'utf8');
    if (!raw.trim()) {
      return [];
    }
    const lines = raw.split(/\r?\n/).filter(Boolean);
    const recent = lines.slice(-Math.max(1, Math.min(Number(limit) || 0, 500)));
    const parsed = [];
    for (const line of recent) {
      try {
        parsed.push(JSON.parse(line));
      } catch (error) {
        parsed.push({ raw: line, parseError: error.message });
      }
    }
    return parsed;
  } catch (error) {
    return [];
  }
}

function resolveAllowedOrigins(origins) {
  if (Array.isArray(origins) && origins.length) {
    return origins;
  }
  return DEFAULT_ALLOWED_ORIGINS;
}

function isRestrictedHostname(hostname) {
  const value = (hostname || '').toLowerCase();
  return (
    value === 'localhost' ||
    value.endsWith('.localhost') ||
    value.endsWith('.local') ||
    value === '::1' ||
    /^127\./.test(value) ||
    /^10\./.test(value) ||
    /^169\.254\./.test(value) ||
    /^192\.168\./.test(value) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(value)
  );
}

function validatePartnerTarget(targetUrl) {
  if (!targetUrl) {
    return { valid: false, reason: 'missing_target' };
  }
  try {
    const parsed = new URL(targetUrl);
    if (!['https:', 'http:'].includes(parsed.protocol)) {
      return { valid: false, reason: 'unsupported_protocol' };
    }
    if (isRestrictedHostname(parsed.hostname)) {
      return { valid: false, reason: 'restricted_host' };
    }
    return { valid: true, sanitized: parsed.toString() };
  } catch (error) {
    return { valid: false, reason: 'invalid_url', detail: error.message };
  }
}

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

app.get('/metrics/ops', async (req, res) => {
  res.set('Content-Type', opsMetrics.contentType());
  res.send(await opsMetrics.metricsSnapshot());
});

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
    deployment: deploymentMode.getStatus(),
    realtimeTelemetry: realtimeTelemetry.status(),
  });
});

app.get('/deployment/status', (req, res) => {
  const status = deploymentMode.getStatus();
  res.json({
    mode: status.mode,
    indicator: status.indicator,
    partnerReady: status.partnerReady,
    liveSince: status.liveSince,
    simulatedSince: status.simulatedSince,
    lastTransition: status.lastTransition,
    hybridCompliance: status.hybridCompliance,
  });
});

app.post(
  '/deployment/mode',
  ...createAuthMiddleware({ requiredRoles: [ROLES.ADMIN], tokenService }),
  ethicsGuard,
  async (req, res) => {
    const { mode } = req.body || {};
    const status = await deploymentMode.setMode(mode, {
      actor: req.user.wallet,
      reason: 'api_toggle',
    });
    signalCompass.emit('trust-map:update', signalCompass.trustMap());
    res.json({ status });
  }
);

app.get('/debug/belief-sandbox', (req, res) => {
  const limit = Number.parseInt(req.query.limit, 10);
  const entries = readSandboxLog(Number.isNaN(limit) ? 200 : limit);
  const config = loadSandboxConfig();
  const componentToggles = ['belief-mechanics', 'loyalty-engine', 'multiplier-core'].reduce(
    (acc, key) => {
      const settings = config?.[key] || {};
      acc[key] = {
        sandbox_mode: Boolean(settings.sandbox_mode),
        log_path: settings.log_path || './logs/belief-sandbox.json',
      };
      return acc;
    },
    {}
  );
  const lastEntry = entries.length ? entries[entries.length - 1] : null;

  res.json({
    sandbox: componentToggles,
    logPath: path.relative(process.cwd(), BELIEF_SANDBOX_LOG),
    entries,
    stats: {
      totalEntries: entries.length,
      lastEntryAt: lastEntry?.timestamp || lastEntry?.time || null,
    },
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
  ...(erc8128Middleware
    ? [createAuthOrErc8128Middleware({
        requiredRoles: [ROLES.PARTNER, ROLES.ADMIN],
        bearerAuth: createAuthMiddleware({ requiredRoles: [ROLES.PARTNER, ROLES.ADMIN], tokenService }),
        erc8128: erc8128Middleware,
      })]
    : createAuthMiddleware({ requiredRoles: [ROLES.PARTNER, ROLES.ADMIN], tokenService })),
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

app.post(
  '/telemetry/realtime',
  ...(erc8128Middleware
    ? [createAuthOrErc8128Middleware({
        requiredRoles: [ROLES.PARTNER, ROLES.ADMIN],
        bearerAuth: createAuthMiddleware({ requiredRoles: [ROLES.PARTNER, ROLES.ADMIN], tokenService }),
        erc8128: erc8128Middleware,
      })]
    : createAuthMiddleware({ requiredRoles: [ROLES.PARTNER, ROLES.ADMIN], tokenService })),
  ethicsGuard,
  (req, res) => {
    const { events, channel, obfuscate } = req.body || {};
    if (typeof obfuscate === 'boolean') {
      realtimeTelemetry.obfuscate = obfuscate;
    }
    const ingestion = realtimeTelemetry.ingest(events, {
      channel: channel || 'telemetry.realtime',
      metadata: { partnerId: req.user.partnerId, mode: deploymentMode.getStatus().mode },
    });
    res.status(202).json({
      status: 'accepted',
      ingestion,
      indicator: deploymentMode.getStatus().indicator,
    });
  }
);

app.get(
  '/vaultfire/rewards/:walletId',
  ...createAuthMiddleware({ requiredRoles: [ROLES.PARTNER, ROLES.ADMIN], tokenService }),
  ethicsGuard,
  async (req, res) => {
    const baseApr = trustConfig.rewards?.baseApr || 6.4;
    const beliefScore = Number.parseFloat(req.query.beliefScore ?? 0.72);
    const contributionCount = Number.parseInt(req.query.contributionCount ?? 0, 10);
    const currentYield = { apr: baseApr, multiplier: 1.15, tierLevel: 'flame' };
    const reputationSummary = reputationBridge.evaluate({
      beliefScore: Number.isNaN(beliefScore) ? 0 : beliefScore,
      contributionCount: Number.isNaN(contributionCount) ? 0 : contributionCount,
      currentApr: baseApr,
      walletId: req.params.walletId,
    });
    currentYield.apr = reputationSummary.totalApr;
    const hybridCompliance = {
      ...trustConfig.rewards?.hybridCompliance,
      ...deploymentMode.getStatus().hybridCompliance,
    };
    if (!hybridCompliance?.governanceApproved) {
      currentYield.symbolic = !reputationSummary.unlocked;
    }
    const streamPreview = await rewardStreamPlanner.previewStream(req.params.walletId, {
      partnerId: req.user.partnerId,
      currentYield,
    });
    const revenuePreview = revenueBridge.preview({
      walletId: req.params.walletId,
      baseMultiplier: streamPreview?.multiplier?.value || currentYield.multiplier || 1,
    });
    const response = {
      walletId: req.params.walletId,
      currentYield,
      signalsReviewed: true,
      streamPreview,
      reputationSummary,
      revenuePreview,
      hybridCompliance,
      deployment: deploymentMode.getStatus(),
    };

    telemetryLedger.record('vaultfire.rewards.view', { walletId: req.params.walletId, partnerId: req.user.partnerId }, {
      tags: ['rewards'],
      visibility: { partner: true, ethics: false, audit: true },
    });

    partnerHooks
      .onRewardEarned({ walletId: req.params.walletId, partnerId: req.user.partnerId, yield: response.currentYield })
      .catch((error) => console.warn('Reward hook delivery error', error));

    if (trustConfig.rewards?.stream?.autoDistribute) {
      rewardStreamPlanner
        .applyContribution(req.params.walletId, {
          partnerId: req.user.partnerId,
          currentYield,
          telemetryId: req.user?.telemetryId || null,
          metadata: { trigger: 'reward-preview' },
        })
        .catch((error) => console.warn('Reward stream dispatch failed', error.message || error));
    }

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
      timestamp: new Date().toISOString(),
      telemetryId: fingerprint.fingerprint,
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
  ...(erc8128Middleware
    ? [createAuthOrErc8128Middleware({
        requiredRoles: [ROLES.PARTNER, ROLES.ADMIN],
        bearerAuth: createAuthMiddleware({ requiredRoles: [ROLES.PARTNER, ROLES.ADMIN], tokenService }),
        erc8128: erc8128Middleware,
      })]
    : createAuthMiddleware({ requiredRoles: [ROLES.PARTNER, ROLES.ADMIN], tokenService })),
  ethicsGuard,
  (req, res) => {
    const { event, targetUrl, metadata = {} } = req.body || {};
    if (!event) {
      return res.status(400).json({ error: { code: 'hooks.invalid_payload', message: 'event is required' } });
    }
    const targetValidation = validatePartnerTarget(targetUrl);
    if (!targetValidation.valid) {
      return res.status(400).json({
        error: {
          code: 'hooks.invalid_target',
          message: `Target URL rejected: ${targetValidation.reason}`,
        },
      });
    }
    try {
      const subscription = partnerHooks.subscribe({
        partnerId: req.user.partnerId,
        event,
        targetUrl: targetValidation.sanitized,
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

app.get(
  '/trust-map',
  ...createAuthMiddleware({ requiredRoles: [ROLES.PARTNER, ROLES.ADMIN], tokenService }),
  ethicsGuard,
  (req, res) => {
    const map = signalCompass.trustMap();
    const narrative = interpreterModule.explainTrustMap(map);
    res.json({ map, narrative });
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

app.post(
  '/belief/actions/sign',
  ...(erc8128Middleware
    ? [createAuthOrErc8128Middleware({
        requiredRoles: [ROLES.CONTRIBUTOR, ROLES.PARTNER, ROLES.ADMIN],
        bearerAuth: createAuthMiddleware({ requiredRoles: [ROLES.CONTRIBUTOR, ROLES.PARTNER, ROLES.ADMIN], tokenService }),
        erc8128: erc8128Middleware,
      })]
    : createAuthMiddleware({ requiredRoles: [ROLES.CONTRIBUTOR, ROLES.PARTNER, ROLES.ADMIN], tokenService })),
  ethicsGuard,
  (req, res) => {
    const { walletId, action, signature, metadata = {} } = req.body || {};
    if (!walletId || !validateWallet(walletId)) {
      return res.status(400).json({
        error: { code: 'belief.invalid_wallet', message: 'walletId is required and must be a valid address' },
      });
    }
    const ledgerEntry = beliefActionLedger.registerSignature({
      walletId: walletId.toLowerCase(),
      action,
      signature,
      metadata: { ...metadata, partnerId: req.user.partnerId, mode: deploymentMode.getStatus().mode },
    });
    res.status(202).json({ status: 'queued', ledgerEntry });
  }
);

function createServer({ corsOrigins } = {}) {
  const allowedOrigins = resolveAllowedOrigins(corsOrigins);
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });
  signalCompass.bindSocket(io);
  return { server, io, allowedOrigins };
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
  opsMetrics,
  deploymentMode,
  realtimeTelemetry,
  beliefActionLedger,
  reputationBridge,
  revenueBridge,
  interpreterModule,
};
