const rateLimit = require('express-rate-limit');
const TokenService = require('./tokenService');
const { hasRequiredRole } = require('./roles');
const { createTrustValidator } = require('../trustValidator');
const legacyAuth = require('./authMiddleware.js');

function extractToken(req: any): string | null {
  const header = req?.headers?.authorization;
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  if (scheme !== 'Bearer') return null;
  return value;
}

interface TrustOptions {
  validator?: { validate: (input: any) => Promise<any> };
  allowedOrigins?: string[];
  sessionWindowMs?: number;
  clockDriftMs?: number;
}

interface TrustedAuthOptions {
  requiredRoles?: string[];
  tokenService?: any;
  trust?: TrustOptions | { validate: (input: any) => Promise<any> } | null;
}

const createAuthMiddleware = legacyAuth?.createAuthMiddleware;

export function createTrustedAuthMiddleware({
  requiredRoles = [],
  tokenService = new TokenService(),
  trust = null,
}: TrustedAuthOptions = {}) {
  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
  });

  let validator: { validate: (input: any) => Promise<any> } | null = null;
  if (trust) {
    if (typeof (trust as any).validate === 'function') {
      validator = trust as any;
    } else {
      validator = createTrustValidator(trust as TrustOptions);
    }
  }

  const middleware = async (req: any, res: any, next: any) => {
    try {
      const token = extractToken(req);
      if (!token) {
        return res.status(401).json({
          error: { code: 'auth.unauthorized', message: 'Missing bearer token' },
        });
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

      if (validator) {
        const originHeader =
          req?.headers?.['x-forwarded-origin'] ??
          req?.headers?.origin ??
          req?.headers?.host ??
          null;
        const sessionToken =
          req?.headers?.['x-vaultfire-session'] ??
          req?.query?.sessionToken ??
          req?.body?.sessionToken ??
          null;
        const signature =
          req?.headers?.['x-vaultfire-signature'] ??
          req?.body?.signature ??
          null;
        const address = decoded.wallet || decoded.address || decoded.sub || null;
        const payload =
          req?.body?.trustPayload ?? {
            resource: req?.originalUrl,
            method: req?.method,
          };

        try {
          const trustResult = await validator.validate({
            origin: originHeader,
            address,
            session: sessionToken,
            signature,
            payload,
          });
          req.trustContext = trustResult;
        } catch (error: any) {
          const code = error?.code || 'trust.invalid';
          return res.status(403).json({
            error: {
              code: `auth.trust.${code}`,
              message: error?.message || 'Trust validation failed',
              detail: error?.meta || null,
            },
          });
        }
      }

      return next();
    } catch (error: any) {
      return res.status(401).json({
        error: {
          code: 'auth.unauthorized',
          message: 'Invalid or expired token',
          detail: error?.message,
        },
      });
    }
  };

  (middleware as any).rateLimiter = limiter;
  (middleware as any).tokenService = tokenService;

  return [limiter, middleware];
}

module.exports = {
  createTrustedAuthMiddleware,
  createAuthMiddleware,
};

export { createAuthMiddleware };
