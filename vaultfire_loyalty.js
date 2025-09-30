'use strict';
/**
 * Vaultfire Loyalty Hook
 * Records opt-in loyalty data for Ghostkey deployments.
 * This module does not provide financial advice.
 */

function clampScore(score) {
  if (Number.isNaN(score) || !Number.isFinite(score)) {
    return 0;
  }
  return Math.max(0, Math.min(1, score));
}

function createBehaviorMetrics(beliefScore = 0, loyaltyMoments = []) {
  const normalizedScore = clampScore(beliefScore);
  const touchpoints = Array.isArray(loyaltyMoments) ? loyaltyMoments.length : 0;
  const density = Math.min(1, normalizedScore * 0.8 + touchpoints * 0.02);
  const sustain = Math.min(1, 0.35 + normalizedScore * 0.5 + touchpoints * 0.01);
  const complexity = Math.min(1, normalizedScore * 0.9 + density * 0.1);
  return {
    beliefComplexityIndex: Number(complexity.toFixed(4)),
    behaviorDensityScore: Number(density.toFixed(4)),
    loyaltySustainRate: Number(sustain.toFixed(4)),
    touchpointCount: touchpoints
  };
}

function initLoyalty(user, options = {}) {
  const timestamp = new Date().toISOString();
  const {
    mode = 'production',
    sandbox = false,
    beliefScore = 0,
    loyaltyMoments = [],
    expiresInMinutes = 120
  } = options;

  const sandboxEnabled = sandbox || mode === 'sandbox';
  const behaviorMetrics = createBehaviorMetrics(beliefScore, loyaltyMoments);

  const record = {
    user,
    loyaltyProtocol: true,
    timestamp,
    environment: sandboxEnabled ? 'sandbox' : 'production',
    behaviorMetrics
  };

  if (sandboxEnabled) {
    record.sandbox = {
      cohortTag: options.cohortTag || 'codex-sandbox',
      expiresAt: new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString(),
      maxTouchpointsPerDay: options.maxTouchpointsPerDay || 12,
      touchpointSpacingSeconds: options.touchpointSpacingSeconds || 45
    };
  }

  return record;
}

module.exports = { initLoyalty, createBehaviorMetrics };
