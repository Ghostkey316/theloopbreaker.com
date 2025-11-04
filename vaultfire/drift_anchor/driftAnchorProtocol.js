'use strict';

const path = require('path');
const fs = require('fs');
const { DriftLogger } = require('./driftLogger');
const { AnchorScoringEngine, DEFAULT_CONFIG } = require('./anchorScoringEngine');
const { GhostPulseDetector } = require('./ghostPulseDetector');

const DEFAULT_DATASET = path.join(__dirname, 'data', 'sample_interactions.json');

function loadDataset(datasetPath = DEFAULT_DATASET) {
  const resolved = path.resolve(datasetPath);
  const payload = fs.readFileSync(resolved, 'utf8');
  return JSON.parse(payload);
}

function buildDriftAnchorReport(data, options = {}) {
  if (!data || !Array.isArray(data.users)) {
    throw new Error('Drift Anchor dataset must include a users array.');
  }

  const clock = () => new Date(options.referenceTime || new Date().toISOString());
  const driftLogger = new DriftLogger({ clock });
  const scoringEngine = new AnchorScoringEngine(options.scoring || DEFAULT_CONFIG);
  const pulseDetector = new GhostPulseDetector(options.detector || {});

  const nowIso = clock().toISOString();
  const results = data.users.map((user) => {
    const interactions = Array.isArray(user.interactions) ? [...user.interactions] : [];
    interactions.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    let entry = null;
    interactions.forEach((interaction) => {
      entry = driftLogger.logInteraction({
        userId: user.id,
        wallet: user.wallet,
        interactionType: interaction.type,
        timestamp: interaction.timestamp,
      });
    });

    if (!entry) {
      entry = driftLogger.logInteraction({
        userId: user.id,
        wallet: user.wallet,
        interactionType: 'no_interaction_recorded',
        timestamp: options.referenceTime || nowIso,
      });
    }

    const driftTimeHours = entry.driftTimeHours;
    const anchorCalculation = scoringEngine.calculate({
      driftTimeHours,
      beliefCoefficient: user.beliefCoefficient ?? 0,
      interactionType: entry.lastInteractionType,
      previousAnchorScore: user.previousAnchorScore ?? 0,
    });

    const pulse = pulseDetector.evaluate({
      userId: user.id,
      wallet: user.wallet,
      driftTimeHours,
      previousBeliefScore: user.previousBeliefScore ?? 0,
    });

    const totalAnchorScore = Math.min(
      scoringEngine.config.maxScore,
      anchorCalculation.anchorScore + (pulse.legacyBonus || 0),
    );

    return {
      userId: user.id || null,
      wallet: user.wallet || null,
      identifierHash: entry.identifierHash,
      driftTimeHours,
      lastInteraction: entry.lastInteraction,
      lastInteractionType: entry.lastInteractionType,
      beliefCoefficient: user.beliefCoefficient ?? 0,
      previousBeliefScore: user.previousBeliefScore ?? 0,
      previousAnchorScore: user.previousAnchorScore ?? 0,
      anchorScore: Number(totalAnchorScore.toFixed(3)),
      anchorMeta: anchorCalculation,
      ghostPulse: pulse.ghostPulse,
      legacyBonusApplied: pulse.legacyBonus,
      legacyBuilder: pulse.legacyBuilder,
      history: entry.history,
    };
  });

  const summary = {
    totalUsers: results.length,
    ghostPulses: results.filter((item) => item.ghostPulse).length,
    legacyBuilders: results.filter((item) => item.legacyBuilder).length,
    generatedAt: nowIso,
  };

  return { summary, results };
}

module.exports = {
  loadDataset,
  buildDriftAnchorReport,
  DEFAULT_DATASET,
};
