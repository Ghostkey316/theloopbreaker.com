const ACTION_BASELINES = {
  quiz: 1.05,
  timeHeld: 1.08,
  vote: 1.12,
  partnerSync: 1.15,
};

const DEFAULT_WEIGHTS = {
  loyalty: 0.4,
  ethics: 0.3,
  frequency: 0.15,
  alignment: 0.1,
  holdDuration: 0.05,
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

function applyWeightOverrides(config) {
  const overrides = config?.weights || null;
  if (!overrides) {
    return { weights: { ...DEFAULT_WEIGHTS }, overrides: [] };
  }

  const weights = { ...DEFAULT_WEIGHTS };
  const changed = [];
  for (const [key, value] of Object.entries(overrides)) {
    if (weights[key] === undefined) {
      // Ignore unsupported metric keys
      // eslint-disable-next-line no-continue
      continue;
    }
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric >= 0) {
      weights[key] = numeric;
      changed.push(`weights.${key}`);
    }
  }

  const total = Object.values(weights).reduce((acc, weight) => acc + weight, 0) || 1;
  const normalized = Object.fromEntries(
    Object.entries(weights).map(([key, weight]) => [key, Number((weight / total).toFixed(6))])
  );

  return { weights: normalized, overrides: changed };
}

function resolveBaseline(actionType, config) {
  const base = baseMultiplierFor(actionType);
  if (!config || config.baselineMultiplier === undefined) {
    return { baseline: base, overrides: [] };
  }
  const override = Number(config.baselineMultiplier);
  if (!Number.isFinite(override) || override <= 0) {
    return { baseline: base, overrides: [] };
  }
  return { baseline: override, overrides: ['baselineMultiplier'] };
}

function computeBeliefMultiplier(actionType, metrics = {}, config = {}) {
  const loyalty = normalize(metrics.loyalty);
  const ethics = normalize(metrics.ethics);
  const frequency = normalize(metrics.frequency ?? metrics.interactionFrequency);
  const alignment = normalize(metrics.alignment ?? metrics.partnerAlignment);
  const duration = normalize(metrics.holdDuration ?? metrics.holdDurationDays);

  const { weights, overrides: weightOverrides } = applyWeightOverrides(config);
  const { baseline, overrides: baselineOverrides } = resolveBaseline(actionType, config);

  const multiplier =
    baseline +
    loyalty * weights.loyalty +
    ethics * weights.ethics +
    frequency * weights.frequency +
    alignment * weights.alignment +
    duration * weights.holdDuration;

  return {
    multiplier: Number(multiplier.toFixed(4)),
    weights,
    baseline,
    overridesDetected: Boolean(weightOverrides.length || baselineOverrides.length),
    overrides: [...weightOverrides, ...baselineOverrides],
  };
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
  DEFAULT_WEIGHTS,
};
