const express = require('express');
const bodyParser = require('body-parser');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
const TokenService = require('./tokenService');
const { createAuthMiddleware } = require('./authMiddleware');
const { ROLES } = require('./roles');
const createEthicsGuard = require('../middleware/ethicsGuard');

const app = express();
const port = process.env.PORT || 4002;

app.use(bodyParser.json());

const tokenService = new TokenService();
const ethicsGuard = createEthicsGuard();

const swaggerPath = path.join(__dirname, '../docs/vaultfire-openapi.yaml');
let swaggerDocument = {};
try {
  swaggerDocument = YAML.load(swaggerPath);
} catch (err) {
  console.warn('Unable to load OpenAPI spec at startup:', err.message);
}

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', beliefEngine: 'synchronized' });
});

app.post('/auth/login', (req, res) => {
  const { userId, role = ROLES.PARTNER, partnerId = 'demo-partner', scopes = [] } = req.body;
  if (!userId) {
    return res.status(400).json({ error: { code: 'auth.invalid_payload', message: 'userId is required' } });
  }

  try {
    const accessToken = tokenService.createAccessToken({ userId, role, partnerId, scopes });
    const refreshToken = tokenService.createRefreshToken({ userId, role, partnerId, scopes });

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

    return res.status(201).json({
      status: 'activated',
      walletId,
      tierLevel: 'flame',
      activatedAt: new Date().toISOString(),
      modules: [
        { moduleId: 'belief-alignment', state: 'initialized' },
        { moduleId: 'loyalty-yield', state: 'queued' },
      ],
    });
  }
);

app.get(
  '/vaultfire/rewards/:walletId',
  ...createAuthMiddleware({ requiredRoles: [ROLES.PARTNER, ROLES.ADMIN], tokenService }),
  ethicsGuard,
  (req, res) => {
    return res.json({
      walletId: req.params.walletId,
      currentYield: { apr: 6.4, multiplier: 1.15, tierLevel: 'flame' },
      signalsReviewed: true,
    });
  }
);

app.post(
  '/vaultfire/mirror',
  ...createAuthMiddleware({ requiredRoles: [ROLES.CONTRIBUTOR, ROLES.PARTNER], tokenService }),
  ethicsGuard,
  (req, res) => {
    return res.status(202).json({
      status: 'mirroring',
      walletId: req.body.walletId,
      alignmentState: 'under_review',
      beliefScore: req.body.beliefScore,
    });
  }
);

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Vaultfire auth example listening on port ${port}`);
  });
}

module.exports = { app, tokenService };
