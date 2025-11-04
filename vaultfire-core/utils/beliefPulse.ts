export const BELIEF_SCORE_MAX = 316;
export const BELIEF_SCORE_MIN = 0;

export interface ResponseWindow {
  triggeredAt: string | number | Date;
  respondedAt: string | number | Date;
}

export interface EngagementEvent {
  timestamp: string | number | Date;
  weight?: number;
}

export interface LoyaltySignal {
  timestamp: string | number | Date;
  category: 'loyalty' | 'presence' | 'action';
  weight?: number;
}

export interface BeliefPulseInput {
  builderId: string;
  buildEvents: EngagementEvent[];
  responseWindows: ResponseWindow[];
  commitTrail: EngagementEvent[];
  loyaltySignals?: LoyaltySignal[];
  evaluationWindowDays?: number;
}

export interface BeliefPulseBreakdown {
  buildConsistency: number;
  responseDiscipline: number;
  commitTrailStrength: number;
  loyaltyPresence: number;
}

export interface BeliefPulseResult {
  builderId: string;
  beliefScore: number;
  breakdown: BeliefPulseBreakdown;
  evaluationWindowDays: number;
}

function toEpoch(value: string | number | Date): number {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === 'number') {
    return value;
  }

  const epoch = new Date(value).getTime();
  if (Number.isNaN(epoch)) {
    throw new Error('Invalid timestamp encountered in BeliefPulse.');
  }

  return epoch;
}

function filterWithinWindow<T extends { timestamp: string | number | Date }>(
  events: T[],
  windowMs: number,
  referenceEpoch: number,
): T[] {
  return events.filter((event) => referenceEpoch - toEpoch(event.timestamp) <= windowMs);
}

function calculateBuildConsistency(events: EngagementEvent[], windowMs: number, referenceEpoch: number): number {
  const windowed = filterWithinWindow(events, windowMs, referenceEpoch);
  if (!windowed.length) {
    return 0;
  }

  const days = windowMs / 86_400_000;
  const buildsPerDay = windowed.length / days;
  const expectedDailyBuilds = 1 / 7; // one build per week keeps the pulse active

  return Math.min(1, buildsPerDay / expectedDailyBuilds);
}

function calculateResponseDiscipline(windows: ResponseWindow[], windowMs: number, referenceEpoch: number): number {
  if (!windows.length) {
    return 0;
  }

  const windowed = windows.filter(({ triggeredAt }) => referenceEpoch - toEpoch(triggeredAt) <= windowMs);
  if (!windowed.length) {
    return 0;
  }

  const averageHours =
    windowed.reduce((sum, window) => {
      const triggerEpoch = toEpoch(window.triggeredAt);
      const responseEpoch = toEpoch(window.respondedAt);
      const duration = Math.max(responseEpoch - triggerEpoch, 0) / 3_600_000;
      return sum + duration;
    }, 0) / windowed.length;

  const disciplinedThresholdHours = 24;
  if (averageHours >= disciplinedThresholdHours) {
    return 0;
  }

  return 1 - averageHours / disciplinedThresholdHours;
}

function calculateCommitTrailStrength(events: EngagementEvent[], windowMs: number, referenceEpoch: number): number {
  const windowed = filterWithinWindow(events, windowMs, referenceEpoch);
  if (!windowed.length) {
    return 0;
  }

  const ordered = [...windowed].sort((a, b) => toEpoch(b.timestamp) - toEpoch(a.timestamp));
  const streakLength = ordered.reduce((streak, event, index, list) => {
    if (index === 0) {
      return 1;
    }

    const previousEpoch = toEpoch(list[index - 1].timestamp);
    const currentEpoch = toEpoch(event.timestamp);
    const diffDays = Math.floor((previousEpoch - currentEpoch) / 86_400_000);

    if (diffDays <= 1) {
      return streak + 1;
    }

    return streak;
  }, 0);

  const normalized = Math.min(1, streakLength / 10); // a ten-day streak maxes the score
  return normalized;
}

function calculateLoyaltyPresence(signals: LoyaltySignal[] = [], windowMs: number, referenceEpoch: number): number {
  if (!signals.length) {
    return 0;
  }

  const windowed = filterWithinWindow(signals, windowMs, referenceEpoch);
  if (!windowed.length) {
    return 0;
  }

  const weighted = windowed.reduce((sum, signal) => sum + (signal.weight ?? defaultLoyaltyWeight(signal.category)), 0);
  const maxExpectedWeight = windowed.length * 2;

  return Math.min(1, weighted / maxExpectedWeight);
}

function defaultLoyaltyWeight(category: LoyaltySignal['category']): number {
  switch (category) {
    case 'action':
      return 2;
    case 'presence':
      return 1.25;
    case 'loyalty':
    default:
      return 1;
  }
}

export function computeBeliefPulse(input: BeliefPulseInput, now: Date = new Date()): BeliefPulseResult {
  const evaluationWindowDays = input.evaluationWindowDays ?? 30;
  const windowMs = evaluationWindowDays * 86_400_000;
  const referenceEpoch = now.getTime();

  const buildConsistency = calculateBuildConsistency(input.buildEvents, windowMs, referenceEpoch);
  const responseDiscipline = calculateResponseDiscipline(input.responseWindows, windowMs, referenceEpoch);
  const commitTrailStrength = calculateCommitTrailStrength(input.commitTrail, windowMs, referenceEpoch);
  const loyaltyPresence = calculateLoyaltyPresence(input.loyaltySignals, windowMs, referenceEpoch);

  const weightedScore =
    buildConsistency * 0.35 +
    responseDiscipline * 0.25 +
    commitTrailStrength * 0.25 +
    loyaltyPresence * 0.15;

  const beliefScore = Math.round(
    Math.max(BELIEF_SCORE_MIN, Math.min(BELIEF_SCORE_MAX, weightedScore * BELIEF_SCORE_MAX)),
  );

  return {
    builderId: input.builderId,
    beliefScore,
    breakdown: {
      buildConsistency,
      responseDiscipline,
      commitTrailStrength,
      loyaltyPresence,
    },
    evaluationWindowDays,
  };
}

export function describeBeliefPulse(result: BeliefPulseResult): string {
  const { builderId, beliefScore, breakdown, evaluationWindowDays } = result;
  const tiers = beliefScore >= 240 ? 'Signal Keeper' : beliefScore >= 160 ? 'Active Builder' : 'Observer';

  return [
    `Belief Pulse for ${builderId}`,
    `Score: ${beliefScore}/${BELIEF_SCORE_MAX} (${tiers})`,
    `Window: ${evaluationWindowDays} days`,
    `Build Consistency: ${(breakdown.buildConsistency * 100).toFixed(1)}%`,
    `Response Discipline: ${(breakdown.responseDiscipline * 100).toFixed(1)}%`,
    `Commit Trail Strength: ${(breakdown.commitTrailStrength * 100).toFixed(1)}%`,
    `Loyalty Presence: ${(breakdown.loyaltyPresence * 100).toFixed(1)}%`,
  ].join('\n');
}
