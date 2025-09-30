const ALLOWED_WEIGHT_KEYS = ['loyalty', 'ethics', 'frequency', 'alignment', 'holdDuration'];

const METRIC_FIELDS = {
  loyalty: ['loyalty'],
  ethics: ['ethics'],
  frequency: ['frequency', 'interactionFrequency'],
  alignment: ['alignment', 'partnerAlignment'],
  holdDuration: ['holdDuration', 'holdDurationDays'],
};

class ValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 422;
    this.details = details;
  }
}

function normalizeMetricValue(value, field) {
  if (value === undefined || value === null) {
    throw new ValidationError(`${field} metric is required.`, { field });
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new ValidationError(`${field} metric cannot be empty.`, { field });
    }
    const numeric = Number(trimmed);
    if (!Number.isFinite(numeric)) {
      throw new ValidationError(`${field} must be numeric.`, { field, value });
    }
    if (numeric < 0 || numeric > 100) {
      throw new ValidationError(`${field} must be between 0 and 100.`, { field, value: numeric });
    }
    return numeric;
  }

  if (typeof value !== 'number') {
    throw new ValidationError(`${field} must be numeric.`, { field, value });
  }

  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new ValidationError(`${field} must be between 0 and 100.`, { field, value });
  }

  return value;
}

function extractMetrics(payload = {}) {
  const source = typeof payload.metrics === 'object' && payload.metrics !== null ? payload.metrics : payload;
  const metrics = {};

  for (const [targetKey, aliases] of Object.entries(METRIC_FIELDS)) {
    const alias = aliases.find((key) => source[key] !== undefined && source[key] !== null);
    if (alias === undefined) {
      throw new ValidationError(`${targetKey} metric is required.`, { field: targetKey });
    }
    metrics[targetKey] = normalizeMetricValue(source[alias], targetKey);
  }

  return metrics;
}

function sanitizeScoringConfig(rawConfig) {
  if (!rawConfig || typeof rawConfig !== 'object') {
    return null;
  }

  const sanitized = {};

  if (rawConfig.weights !== undefined) {
    if (!rawConfig.weights || typeof rawConfig.weights !== 'object') {
      throw new ValidationError('scoringConfig.weights must be an object mapping metrics to weights.', {
        field: 'scoringConfig.weights',
      });
    }

    const weights = {};
    let hasWeight = false;
    for (const key of ALLOWED_WEIGHT_KEYS) {
      if (rawConfig.weights[key] !== undefined) {
        const numeric = Number(rawConfig.weights[key]);
        if (!Number.isFinite(numeric) || numeric < 0) {
          throw new ValidationError(`Weight for ${key} must be a non-negative number.`, {
            field: `scoringConfig.weights.${key}`,
          });
        }
        weights[key] = numeric;
        hasWeight = true;
      }
    }

    if (!hasWeight) {
      throw new ValidationError('scoringConfig.weights must reference at least one supported metric.', {
        field: 'scoringConfig.weights',
      });
    }

    sanitized.weights = weights;
  }

  if (rawConfig.baselineMultiplier !== undefined) {
    const baseline = Number(rawConfig.baselineMultiplier);
    if (!Number.isFinite(baseline) || baseline < 0.5 || baseline > 3) {
      throw new ValidationError('scoringConfig.baselineMultiplier must be between 0.5 and 3.', {
        field: 'scoringConfig.baselineMultiplier',
      });
    }
    sanitized.baselineMultiplier = baseline;
  }

  return Object.keys(sanitized).length ? sanitized : null;
}

function validateMetrics(metrics = {}) {
  return extractMetrics({ metrics });
}

module.exports = {
  ValidationError,
  extractMetrics,
  sanitizeScoringConfig,
  validateMetrics,
  METRIC_FIELDS,
  ALLOWED_WEIGHT_KEYS,
};
