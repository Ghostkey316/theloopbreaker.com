const ACTION_BASELINES = {
  quiz: 1.05,
  timeHeld: 1.08,
  vote: 1.12,
  partnerSync: 1.15,
};

const TIER_THRESHOLDS = [
  { name: 'Mythic', min: 1.6 },
  { name: 'Ascendant', min: 1.3 },
  { name: 'Aligned', min: 1.1 },
  { name: 'Initiate', min: 1 },
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalize(value) {
  if (value === undefined || value === null) {
    return 0;
  }
  if (typeof value === 'number') {
    return clamp(value, 0, 100) / 100;
  }
  if (typeof value === 'string') {
    const numeric = parseFloat(value);
    if (Number.isNaN(numeric)) {
      return 0;
    }
    return clamp(numeric, 0, 100) / 100;
  }
  return 0;
}

function baseMultiplierFor(actionType) {
  return ACTION_BASELINES[actionType] || 1.02;
}

function computeBeliefMultiplier(actionType, metrics = {}) {
  const loyalty = normalize(metrics.loyalty);
  const ethics = normalize(metrics.ethics);
  const frequency = normalize(metrics.frequency ?? metrics.interactionFrequency);
  const alignment = normalize(metrics.alignment ?? metrics.partnerAlignment);
  const duration = normalize(metrics.holdDuration ?? metrics.holdDurationDays);

  const base = baseMultiplierFor(actionType);
  const loyaltySignal = loyalty * 0.4;
  const ethicsSignal = ethics * 0.3;
  const frequencySignal = frequency * 0.15;
  const alignmentSignal = alignment * 0.1;
  const durationSignal = duration * 0.05;

  const multiplier = base + loyaltySignal + ethicsSignal + frequencySignal + alignmentSignal + durationSignal;
  return Number(multiplier.toFixed(4));
}

function determineTier(multiplier) {
  for (const tier of TIER_THRESHOLDS) {
    if (multiplier >= tier.min) {
      return tier.name;
    }
  }
  return 'Observer';
}

module.exports = {
  computeBeliefMultiplier,
  determineTier,
  baseMultiplierFor,
};
