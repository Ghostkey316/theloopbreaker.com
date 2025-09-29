const rateLimit = require('express-rate-limit');
const TokenService = require('./tokenService');
const { hasRequiredRole } = require('./roles');

function extractToken(req) {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  if (scheme !== 'Bearer') return null;
  return value;
}

function createAuthMiddleware({ requiredRoles = [], tokenService = new TokenService() } = {}) {
  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
  });
  const middleware = async (req, res, next) => {
    try {
      const token = extractToken(req);
      if (!token) {
        return res.status(401).json({ error: { code: 'auth.unauthorized', message: 'Missing bearer token' } });
      }

      const decoded = tokenService.verifyAccessToken(token);
      if (!hasRequiredRole(decoded.role, requiredRoles)) {
        return res.status(403).json({
          error: {
            code: 'auth.forbidden',
            message: 'Insufficient role access for this resource.',
          },
        });
      }

      req.user = decoded;
      return next();
    } catch (error) {
      return res.status(401).json({
        error: {
          code: 'auth.unauthorized',
          message: 'Invalid or expired token',
          detail: error.message,
        },
      });
    }
  };

  middleware.rateLimiter = limiter;
  middleware.tokenService = tokenService;
  return [limiter, middleware];
}

module.exports = {
  createAuthMiddleware,
};
