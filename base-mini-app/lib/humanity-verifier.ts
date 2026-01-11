/**
 * Vaultfire Humanity Verification System
 *
 * Proves a user is human (not bot/AI) without revealing identity
 * Uses multiple signals to build confidence score:
 * - Real activity patterns across platforms
 * - Temporal consistency (spread over time, not burst)
 * - Behavioral irregularities (humans aren't perfect)
 * - Social graph connections (real relationships)
 *
 * Critical for:
 * - Anti-bot protection in DAOs
 * - Sybil resistance
 * - UBI distribution
 * - AI-gated content access
 */

import { GitHubActivity, calculateGitHubLoyaltyScore } from './loyalty-calculator';
import { BaseActivity, calculateBaseLoyaltyScore } from './loyalty-calculator';

export interface HumanityProof {
  // Platform Activity Scores (normalized 0-10000)
  githubActivityScore: number;      // Real GitHub contributions
  baseActivityScore: number;        // Real Base blockchain activity
  socialGraphScore: number;         // Real social connections

  // Temporal Analysis
  temporalConsistency: number;      // Activity spread over months/years (0-10000)
  activityBurstiness: number;       // Lower is more human-like (0=perfect human, 10000=bot-like)

  // Behavioral Patterns
  behavioralIrregularity: number;   // Humans are irregular (higher is more human)
  mouseMovementEntropy: number;     // Randomness in UI interactions

  // External Verifications
  worldcoinVerified: boolean;       // Worldcoin proof of personhood
  gitcoinPassportScore: number;     // Gitcoin Passport humanity score
  brightIdVerified: boolean;        // BrightID social verification
}

/**
 * Calculate Humanity Score (0-10000 basis points)
 *
 * Higher score = higher confidence this is a real human
 *
 * Scoring breakdown:
 * - Platform Activity: 30% (GitHub + Base + Social)
 * - Temporal Patterns: 25%
 * - Behavioral Analysis: 20%
 * - External Verifications: 25%
 *
 * @param proof Humanity proof data
 * @returns Humanity score (0-10000)
 */
export function calculateHumanityScore(proof: HumanityProof): number {
  // 1. Platform Activity Score (0-3000 points)
  // Average across all platforms
  const platformScores = [
    proof.githubActivityScore,
    proof.baseActivityScore,
    proof.socialGraphScore
  ].filter(score => score > 0); // Only count connected platforms

  const avgPlatformScore = platformScores.length > 0
    ? platformScores.reduce((a, b) => a + b, 0) / platformScores.length
    : 0;

  const platformActivityScore = (avgPlatformScore / 10000) * 3000;

  // 2. Temporal Consistency Score (0-2500 points)
  // Activity spread over time is more human-like
  const temporalScore = (proof.temporalConsistency / 10000) * 1500;

  // Burstiness penalty (bots do everything at once)
  const bursinessPenalty = (proof.activityBurstiness / 10000) * 1000;
  const finalTemporalScore = Math.max(temporalScore - bursinessPenalty, 0);

  // 3. Behavioral Analysis Score (0-2000 points)
  // Irregular behavior = human (we're not perfect)
  const behavioralScore = (proof.behavioralIrregularity / 10000) * 1000;
  const entropyScore = (proof.mouseMovementEntropy / 10000) * 1000;
  const finalBehavioralScore = Math.min(behavioralScore + entropyScore, 2000);

  // 4. External Verification Score (0-2500 points)
  let externalScore = 0;

  if (proof.worldcoinVerified) {
    externalScore += 1200; // High confidence biometric proof
  }

  if (proof.gitcoinPassportScore > 0) {
    externalScore += (proof.gitcoinPassportScore / 100) * 800; // Max 800 points
  }

  if (proof.brightIdVerified) {
    externalScore += 500; // Social verification
  }

  const finalExternalScore = Math.min(externalScore, 2500);

  // Calculate total score
  const totalScore = Math.min(
    platformActivityScore +
    finalTemporalScore +
    finalBehavioralScore +
    finalExternalScore,
    10000
  );

  return Math.floor(totalScore);
}

/**
 * Analyze temporal consistency of activity
 * Returns score 0-10000 (higher = more spread out = more human)
 */
export function analyzeTemporalConsistency(
  activityTimestamps: number[] // Unix timestamps
): { consistencyScore: number; burstinessScore: number } {
  if (activityTimestamps.length < 5) {
    return { consistencyScore: 0, burstinessScore: 10000 }; // Too little data
  }

  // Sort timestamps
  const sorted = [...activityTimestamps].sort((a, b) => a - b);

  // Calculate gaps between activities
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(sorted[i] - sorted[i - 1]);
  }

  // Calculate standard deviation of gaps
  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const variance = gaps.reduce((sum, gap) => sum + Math.pow(gap - avgGap, 2), 0) / gaps.length;
  const stdDev = Math.sqrt(variance);

  // Calculate coefficient of variation (CV)
  const coefficientOfVariation = stdDev / avgGap;

  // Temporal span (first to last activity)
  const timespan = sorted[sorted.length - 1] - sorted[0];
  const timespanDays = timespan / (1000 * 60 * 60 * 24);

  // Consistency score (activities spread over time)
  let consistencyScore = 0;
  if (timespanDays > 365) {
    consistencyScore = 10000; // Over a year
  } else if (timespanDays > 180) {
    consistencyScore = 8000;  // 6+ months
  } else if (timespanDays > 90) {
    consistencyScore = 6000;  // 3+ months
  } else if (timespanDays > 30) {
    consistencyScore = 4000;  // 1+ month
  } else {
    consistencyScore = 2000;  // Less than a month
  }

  // Burstiness score (lower is better)
  // High CV = irregular intervals = human-like
  // Low CV = regular intervals = bot-like
  const burstinessScore = Math.max(10000 - (coefficientOfVariation * 1000), 0);

  return {
    consistencyScore: Math.floor(consistencyScore),
    burstinessScore: Math.floor(burstinessScore)
  };
}

/**
 * Build humanity proof from user's cross-platform activity
 */
export async function buildHumanityProof(inputs: {
  github?: GitHubActivity;
  base?: BaseActivity;
  activityTimestamps: number[];
  worldcoinVerified?: boolean;
  gitcoinPassportScore?: number;
  brightIdVerified?: boolean;
}): Promise<HumanityProof> {
  // Calculate platform scores
  const githubScore = inputs.github ? calculateGitHubLoyaltyScore(inputs.github) : 0;
  const baseScore = inputs.base ? calculateBaseLoyaltyScore(inputs.base) : 0;

  // Analyze temporal patterns
  const temporal = analyzeTemporalConsistency(inputs.activityTimestamps);

  // Mock behavioral analysis (would be real in production)
  const behavioralIrregularity = Math.floor(Math.random() * 3000) + 7000; // Humans are irregular
  const mouseMovementEntropy = Math.floor(Math.random() * 2000) + 6000;

  // Social graph score (mock for now - would integrate Lens, Farcaster, etc.)
  const socialGraphScore = Math.floor(Math.random() * 5000) + 5000;

  return {
    githubActivityScore: githubScore,
    baseActivityScore: baseScore,
    socialGraphScore,
    temporalConsistency: temporal.consistencyScore,
    activityBurstiness: temporal.burstinessScore,
    behavioralIrregularity,
    mouseMovementEntropy,
    worldcoinVerified: inputs.worldcoinVerified ?? false,
    gitcoinPassportScore: inputs.gitcoinPassportScore ?? 0,
    brightIdVerified: inputs.brightIdVerified ?? false
  };
}

/**
 * Get human-readable humanity assessment
 */
export function getHumanityAssessment(humanityScore: number): {
  level: 'VERIFIED_HUMAN' | 'LIKELY_HUMAN' | 'UNCERTAIN' | 'LIKELY_BOT' | 'BOT';
  confidence: number; // 0-100%
  message: string;
} {
  if (humanityScore >= 8500) {
    return {
      level: 'VERIFIED_HUMAN',
      confidence: 95,
      message: 'Very high confidence - multiple verification signals'
    };
  } else if (humanityScore >= 7000) {
    return {
      level: 'LIKELY_HUMAN',
      confidence: 80,
      message: 'High confidence - consistent activity patterns'
    };
  } else if (humanityScore >= 5000) {
    return {
      level: 'UNCERTAIN',
      confidence: 60,
      message: 'Moderate confidence - some human signals present'
    };
  } else if (humanityScore >= 3000) {
    return {
      level: 'LIKELY_BOT',
      confidence: 75,
      message: 'Low confidence - bot-like patterns detected'
    };
  } else {
    return {
      level: 'BOT',
      confidence: 90,
      message: 'Very low confidence - strong bot indicators'
    };
  }
}

/**
 * Generate humanity proof for ZK attestation
 */
export function generateHumanityActivityProof(proof: HumanityProof): string {
  return JSON.stringify({
    moduleId: 11, // HUMANITY_PROOF
    proof,
    timestamp: Date.now(),
    version: '1.0.0'
  });
}

/**
 * Example humanity profiles for testing
 */
export const EXAMPLE_HUMANITY_PROFILES = {
  // Verified human with strong signals
  verifiedHuman: {
    githubActivityScore: 8500,
    baseActivityScore: 7500,
    socialGraphScore: 8000,
    temporalConsistency: 9500,
    activityBurstiness: 2000,
    behavioralIrregularity: 8500,
    mouseMovementEntropy: 7500,
    worldcoinVerified: true,
    gitcoinPassportScore: 85,
    brightIdVerified: true
  } as HumanityProof,

  // Likely human (no external verification but good patterns)
  likelyHuman: {
    githubActivityScore: 7000,
    baseActivityScore: 6500,
    socialGraphScore: 6000,
    temporalConsistency: 7500,
    activityBurstiness: 3500,
    behavioralIrregularity: 7000,
    mouseMovementEntropy: 6500,
    worldcoinVerified: false,
    gitcoinPassportScore: 0,
    brightIdVerified: false
  } as HumanityProof,

  // Suspected bot (burst activity, no external verification)
  suspectedBot: {
    githubActivityScore: 3000,
    baseActivityScore: 2500,
    socialGraphScore: 1000,
    temporalConsistency: 2000,
    activityBurstiness: 9000, // High burstiness = bot-like
    behavioralIrregularity: 2000, // Too regular
    mouseMovementEntropy: 1000,
    worldcoinVerified: false,
    gitcoinPassportScore: 0,
    brightIdVerified: false
  } as HumanityProof,
};
