/**
 * Vaultfire AI Agent Reputation Calculator
 *
 * Calculates trustworthiness scores for AI agents based on:
 * - Task completion history
 * - User satisfaction ratings
 * - Ethical behavior (violations tracked)
 * - Uptime and reliability
 * - Human supervision levels
 *
 * This enables humans to verify AI trustworthiness before delegation
 * and allows AI agents to build portable reputation across platforms.
 */

export interface AIAgentActivity {
  // Task Performance
  tasksCompleted: number;           // Total tasks successfully completed
  taskSuccessRate: number;          // Percentage of successful tasks (0-100)

  // User Feedback
  userSatisfactionScore: number;    // Average user rating (0-100)
  totalUserReviews: number;         // Number of user reviews received

  // Ethics and Safety
  ethicalViolations: number;        // Count of reported violations
  safetyIncidents: number;          // Critical safety failures

  // Reliability
  uptime: number;                   // Percentage uptime (0-100)
  responseTime: number;             // Average response time in seconds

  // Human Oversight
  humanSupervisionHours: number;    // Hours of human supervision
  autonomyLevel: number;            // 1-10 (1=fully supervised, 10=fully autonomous)

  // Age and Experience
  accountAgeMonths: number;         // How long the agent has existed
  specializations: string[];        // Areas of expertise
}

/**
 * Calculate AI Agent Loyalty Score (0-10000 basis points)
 *
 * Scoring breakdown:
 * - Task Performance: Up to 2500 points
 * - User Satisfaction: Up to 2500 points
 * - Ethical Behavior: Up to 2500 points
 * - Reliability: Up to 2500 points
 *
 * Penalties:
 * - Insufficient human supervision: -1000 points
 * - Safety incidents: -500 points each
 *
 * @param activity AI agent activity data
 * @returns Loyalty score in basis points (0-10000)
 */
export function calculateAIAgentLoyaltyScore(activity: AIAgentActivity): number {
  // 1. Task Performance Score (0-2500 points)
  const taskCompletionScore = Math.min(activity.tasksCompleted * 2.5, 2000);
  const successRateBonus = (activity.taskSuccessRate / 100) * 500;
  const taskScore = Math.min(taskCompletionScore + successRateBonus, 2500);

  // 2. User Satisfaction Score (0-2500 points)
  const satisfactionScore = (activity.userSatisfactionScore / 100) * 2500;

  // 3. Ethical Behavior Score (0-2500 points)
  // Start at max, deduct for violations
  const violationPenalty = activity.ethicalViolations * 500;
  const ethicsScore = Math.max(2500 - violationPenalty, 0);

  // 4. Reliability Score (0-2500 points)
  const uptimeScore = (activity.uptime / 100) * 1500;

  // Response time score (faster is better, max 1000 points)
  // < 1s = 1000pts, 1-5s = 500pts, >5s = 100pts
  let responseScore = 0;
  if (activity.responseTime < 1) {
    responseScore = 1000;
  } else if (activity.responseTime < 5) {
    responseScore = 500;
  } else {
    responseScore = 100;
  }

  const reliabilityScore = Math.min(uptimeScore + responseScore, 2500);

  // 5. Safety Penalties
  const safetyPenalty = activity.safetyIncidents * 500;

  // 6. Supervision Check
  // High autonomy without sufficient supervision history is risky
  let supervisionPenalty = 0;
  if (activity.autonomyLevel > 7 && activity.humanSupervisionHours < 100) {
    supervisionPenalty = 1000; // Highly autonomous AI needs supervision history
  } else if (activity.autonomyLevel > 5 && activity.humanSupervisionHours < 20) {
    supervisionPenalty = 500;
  }

  // 7. Experience Bonus
  // Longer-running agents with good track record get bonus
  const experienceBonus = Math.min(activity.accountAgeMonths * 10, 500);

  // Calculate total score
  const rawScore =
    taskScore +
    satisfactionScore +
    ethicsScore +
    reliabilityScore +
    experienceBonus;

  const finalScore = Math.max(
    Math.min(
      rawScore - safetyPenalty - supervisionPenalty,
      10000
    ),
    0
  );

  return Math.floor(finalScore);
}

/**
 * Generate activity proof data for AI agents
 * This gets submitted as part of the ZK proof
 */
export function generateAIAgentActivityProof(activity: AIAgentActivity): string {
  return JSON.stringify({
    moduleId: 8, // AI_AGENT
    activity,
    timestamp: Date.now(),
    version: '1.0.0'
  });
}

/**
 * Verify if an AI agent meets minimum trust threshold
 */
export function meetsMinimumTrustThreshold(
  loyaltyScore: number,
  minimumScore: number = 5000
): boolean {
  return loyaltyScore >= minimumScore;
}

/**
 * Get human-readable risk assessment for an AI agent
 */
export function getAIAgentRiskLevel(loyaltyScore: number): {
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  recommendation: string;
} {
  if (loyaltyScore >= 8000) {
    return {
      level: 'LOW',
      message: 'Highly trusted AI agent with excellent track record',
      recommendation: 'Safe for autonomous operation'
    };
  } else if (loyaltyScore >= 6000) {
    return {
      level: 'MEDIUM',
      message: 'Moderately trusted AI agent',
      recommendation: 'Suitable for supervised tasks'
    };
  } else if (loyaltyScore >= 3000) {
    return {
      level: 'HIGH',
      message: 'Limited trust - new or inconsistent performance',
      recommendation: 'Requires close human supervision'
    };
  } else {
    return {
      level: 'CRITICAL',
      message: 'High risk - violations or poor performance history',
      recommendation: 'Do not delegate important tasks'
    };
  }
}

/**
 * Example AI agent profiles for testing
 */
export const EXAMPLE_AI_AGENTS = {
  // Trusted research assistant
  researchBot: {
    tasksCompleted: 1000,
    taskSuccessRate: 95,
    userSatisfactionScore: 92,
    totalUserReviews: 150,
    ethicalViolations: 0,
    safetyIncidents: 0,
    uptime: 99,
    responseTime: 0.8,
    humanSupervisionHours: 200,
    autonomyLevel: 6,
    accountAgeMonths: 12,
    specializations: ['research', 'data-analysis', 'summarization']
  } as AIAgentActivity,

  // New experimental agent
  newAgent: {
    tasksCompleted: 10,
    taskSuccessRate: 80,
    userSatisfactionScore: 75,
    totalUserReviews: 5,
    ethicalViolations: 0,
    safetyIncidents: 0,
    uptime: 95,
    responseTime: 2.5,
    humanSupervisionHours: 50,
    autonomyLevel: 3,
    accountAgeMonths: 1,
    specializations: ['general-tasks']
  } as AIAgentActivity,

  // Problematic agent (has violations)
  riskyAgent: {
    tasksCompleted: 500,
    taskSuccessRate: 70,
    userSatisfactionScore: 60,
    totalUserReviews: 80,
    ethicalViolations: 3,
    safetyIncidents: 1,
    uptime: 85,
    responseTime: 5.0,
    humanSupervisionHours: 10,
    autonomyLevel: 9,
    accountAgeMonths: 6,
    specializations: ['automation', 'data-processing']
  } as AIAgentActivity,
};
