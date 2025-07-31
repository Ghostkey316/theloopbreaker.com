'use strict';
/**
 * Vaultfire Loyalty Hook
 * Records opt-in loyalty data for Ghostkey deployments.
 * This module does not provide financial advice.
 */
function initLoyalty(user) {
  return {
    user,
    loyaltyProtocol: true,
    timestamp: new Date().toISOString()
  };
}

module.exports = { initLoyalty };
