'use strict';

const path = require('path');
const { DriftLogger } = require('../vaultfire/drift_anchor/driftLogger');
const { AnchorScoringEngine } = require('../vaultfire/drift_anchor/anchorScoringEngine');
const { GhostPulseDetector } = require('../vaultfire/drift_anchor/ghostPulseDetector');
const {
  buildDriftAnchorReport,
} = require('../vaultfire/drift_anchor/driftAnchorProtocol');

function hoursBetween(start, end) {
  return (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000;
}

describe('Drift Anchor protocol primitives', () => {
  test('DriftLogger calculates drift between interactions', () => {
    const logger = new DriftLogger();
    const first = logger.logInteraction({
      userId: 'alice',
      interactionType: 'github_commit',
      timestamp: '2025-01-01T00:00:00Z',
    });
    expect(first.driftTimeHours).toBe(0);

    const second = logger.logInteraction({
      userId: 'alice',
      interactionType: 'dapp_use',
      timestamp: '2025-01-05T00:00:00Z',
    });

    expect(second.driftTimeHours).toBeCloseTo(hoursBetween('2025-01-01T00:00:00Z', '2025-01-05T00:00:00Z'));
    expect(logger.entries()).toHaveLength(1);
  });

  test('AnchorScoringEngine applies decay and clamps to max score', () => {
    const engine = new AnchorScoringEngine({ maxScore: 111 });
    const result = engine.calculate({
      driftTimeHours: 240,
      beliefCoefficient: 0.8,
      interactionType: 'github_commit',
    });

    expect(result.anchorScore).toBeLessThanOrEqual(111);
    expect(result.decayMultiplier).toBeGreaterThan(0);
  });

  test('GhostPulseDetector flags long returns and legacy bonus', () => {
    const detector = new GhostPulseDetector({ thresholdDays: 7, legacyBonusValue: 13 });
    const result = detector.evaluate({
      userId: 'legacy',
      driftTimeHours: 8 * 24,
      previousBeliefScore: 300,
    });

    expect(result.ghostPulse).toBe(true);
    expect(result.legacyBonus).toBe(13);
    expect(result.legacyBuilder).toBe(true);
  });
});

describe('Drift Anchor protocol integration', () => {
  test('buildDriftAnchorReport produces exportable payload', () => {
    const datasetPath = path.resolve(__dirname, '..', 'vaultfire', 'drift_anchor', 'data', 'sample_interactions.json');
    // eslint-disable-next-line global-require
    const dataset = require(datasetPath);
    const report = buildDriftAnchorReport(dataset, { referenceTime: '2025-02-15T00:00:00Z' });

    expect(report.summary.totalUsers).toBe(dataset.users.length);
    const legacyEntry = report.results.find((item) => item.userId === 'legacy_builder');
    expect(legacyEntry).toBeDefined();
    expect(legacyEntry.ghostPulse).toBe(true);
    expect(legacyEntry.legacyBuilder).toBe(true);
    expect(legacyEntry.anchorScore).toBeLessThanOrEqual(111);
  });
});
