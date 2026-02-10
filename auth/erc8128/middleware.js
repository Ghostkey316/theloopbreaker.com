'use strict';

const { ROLES } = require('../roles');
const { verifyRequest } = require('./verify');

function createErc8128Middleware({ requiredRole = ROLES.PARTNER, nonceStore, providersByChainId, policy } = {}) {
  if (!nonceStore) {
    throw new Error('erc8128 middleware requires a nonceStore');
  }
  if (!providersByChainId) {
    throw new Error('erc8128 middleware requires providersByChainId');
  }

  return async function erc8128Middleware(req, res, next) {
    try {
      const result = await verifyRequest(req, {
        nonceStore,
        providersByChainId,
        ...(policy || {}),
      });

      if (!result.ok) {
        return res.status(401).json({
          error: {
            code: result.code || 'auth.erc8128.unauthorized',
            message: result.message || 'ERC-8128 verification failed',
          },
        });
      }

      // Map ERC-8128 auth to Vaultfire's existing user model.
      req.user = {
        wallet: result.wallet,
        role: requiredRole,
        partnerId: req.user?.partnerId || 'erc8128',
        scopes: [],
        chainId: result.chainId,
        authType: result.authType,
        authMode: result.mode,
      };

      return next();
    } catch (error) {
      return res.status(401).json({
        error: {
          code: 'auth.erc8128.error',
          message: 'ERC-8128 auth error',
          detail: error.message,
        },
      });
    }
  };
}

/**
 * Transition helper: accept either Bearer JWT or ERC-8128.
 */
function createAuthOrErc8128Middleware({ requiredRoles = [], bearerAuth = null, erc8128 = null } = {}) {
  if (!bearerAuth || !erc8128) {
    throw new Error('createAuthOrErc8128Middleware requires bearerAuth and erc8128 middleware');
  }

  // bearerAuth is an array returned by createAuthMiddleware: [limiter, middleware]
  const bearer = Array.isArray(bearerAuth) ? bearerAuth[bearerAuth.length - 1] : bearerAuth;

  return async function authOrErc8128(req, res, next) {
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
      return bearer(req, res, next);
    }
    return erc8128(req, res, next);
  };
}

module.exports = {
  createErc8128Middleware,
  createAuthOrErc8128Middleware,
};
