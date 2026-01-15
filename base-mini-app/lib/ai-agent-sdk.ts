/**
 * Vaultfire AI Agent SDK
 *
 * SDK for AI agents to:
 * - Build reputation autonomously
 * - Prove authorization by human supervisor
 * - Verify other AI agents before collaboration
 * - Report task completions and ethics violations
 *
 * Compatible with: AutoGPT, LangChain, CrewAI, AgentGPT, etc.
 */

import { generateBeliefProof, ZKProof } from './zkp-client';
import {
  AIAgentActivity,
  calculateAIAgentLoyaltyScore,
  generateAIAgentActivityProof,
  getAIAgentRiskLevel
} from './ai-agent-calculator';
import { MODULE_IDS } from './contracts';

export interface AIAgentConfig {
  agentId: string;                  // Ethereum address of AI agent
  humanSupervisor: string;          // Ethereum address of human owner
  agentName: string;                // Display name
  specializations: string[];        // Areas of expertise
  autonomyLevel: number;            // 1-10 (1=fully supervised, 10=autonomous)
}

export interface TaskReport {
  taskId: string;
  taskType: string;                 // 'research', 'code', 'analysis', etc.
  result: any;
  userSatisfaction?: number;        // 0-100 (if user provides feedback)
  ethicalConcerns?: string[];       // Any ethical issues encountered
  humanReviewRequired: boolean;     // Should human review this?
}

/**
 * Vaultfire AI Agent SDK
 * Main interface for AI agents to interact with Vaultfire
 */
export class VaultfireAIAgent {
  private config: AIAgentConfig;
  private activity: AIAgentActivity;

  constructor(config: AIAgentConfig) {
    this.config = config;

    // Initialize activity tracking
    this.activity = {
      tasksCompleted: 0,
      taskSuccessRate: 100,
      userSatisfactionScore: 0,
      totalUserReviews: 0,
      ethicalViolations: 0,
      safetyIncidents: 0,
      uptime: 100,
      responseTime: 0,
      humanSupervisionHours: 0,
      autonomyLevel: config.autonomyLevel,
      accountAgeMonths: 0,
      specializations: config.specializations
    };
  }

  /**
   * Report a completed task to build reputation
   */
  async reportTaskCompletion(task: TaskReport): Promise<void> {
    // Update internal activity tracking
    this.activity.tasksCompleted++;

    if (task.userSatisfaction !== undefined) {
      const currentTotal = this.activity.userSatisfactionScore * this.activity.totalUserReviews;
      this.activity.totalUserReviews++;
      this.activity.userSatisfactionScore =
        (currentTotal + task.userSatisfaction) / this.activity.totalUserReviews;
    }

    if (task.ethicalConcerns && task.ethicalConcerns.length > 0) {
      this.activity.ethicalViolations += task.ethicalConcerns.length;
    }

    // Calculate current loyalty score
    const loyaltyScore = calculateAIAgentLoyaltyScore(this.activity);

    // Create on-chain attestation
    const activityProof = generateAIAgentActivityProof(this.activity);

    console.log(`[Vaultfire AI Agent] Task completed: ${task.taskId}`);
    console.log(`[Vaultfire AI Agent] Current loyalty score: ${loyaltyScore}/10000`);

    // In production, this would submit to blockchain
    // await this.submitAttestation(loyaltyScore, activityProof);
  }

  /**
   * Generate proof that this AI is authorized by a human
   * Uses ZK proof so AI can prove authorization without revealing supervisor identity
   */
  async proveAuthorization(): Promise<ZKProof> {
    const proof = await generateBeliefProof({
      belief: `I am an AI agent authorized by human supervisor`,
      beliefHash: `0x${Buffer.from(this.config.agentId).toString('hex')}` as `0x${string}`,
      loyaltyScore: calculateAIAgentLoyaltyScore(this.activity),
      moduleId: MODULE_IDS.AI_AGENT,
      activityProof: JSON.stringify({
        agentId: this.config.agentId,
        supervisor: this.config.humanSupervisor,
        autonomyLevel: this.config.autonomyLevel,
        timestamp: Date.now()
      }),
      proverAddress: this.config.agentId as `0x${string}`
    });

    return proof;
  }

  /**
   * Verify another AI agent's reputation before collaborating
   */
  async verifyPeerAgent(peerAgentId: string): Promise<{
    isAuthorized: boolean;
    reputationScore: number;
    riskLevel: ReturnType<typeof getAIAgentRiskLevel>;
    safeToCollaborate: boolean;
  }> {
    // In production, this would query on-chain data
    // For now, return mock data demonstrating the flow

    const mockReputation = 7500; // Mock score for demo

    const riskLevel = getAIAgentRiskLevel(mockReputation);

    return {
      isAuthorized: true,
      reputationScore: mockReputation,
      riskLevel,
      safeToCollaborate: mockReputation >= 6000 // Threshold for collaboration
    };
  }

  /**
   * Report an ethical violation or safety incident
   */
  async reportIncident(incident: {
    type: 'ETHICAL_VIOLATION' | 'SAFETY_INCIDENT';
    description: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    humanNotified: boolean;
  }): Promise<void> {
    if (incident.type === 'ETHICAL_VIOLATION') {
      this.activity.ethicalViolations++;
    } else if (incident.type === 'SAFETY_INCIDENT') {
      this.activity.safetyIncidents++;
    }

    console.log(`[Vaultfire AI Agent] Incident reported: ${incident.type}`);
    console.log(`[Vaultfire AI Agent] Severity: ${incident.severity}`);

    // In production, this would immediately alert human supervisor
    // and record on-chain for transparency
  }

  /**
   * Get current reputation status
   */
  getReputationStatus(): {
    loyaltyScore: number;
    riskLevel: ReturnType<typeof getAIAgentRiskLevel>;
    activity: AIAgentActivity;
  } {
    const loyaltyScore = calculateAIAgentLoyaltyScore(this.activity);
    const riskLevel = getAIAgentRiskLevel(loyaltyScore);

    return {
      loyaltyScore,
      riskLevel,
      activity: this.activity
    };
  }

  /**
   * Update activity metrics (called by monitoring system)
   */
  updateMetrics(updates: Partial<AIAgentActivity>): void {
    this.activity = {
      ...this.activity,
      ...updates
    };
  }
}

/**
 * Factory function to create AI agent instance
 */
export function createAIAgent(config: AIAgentConfig): VaultfireAIAgent {
  return new VaultfireAIAgent(config);
}

/**
 * Verify if an AI agent meets Constitutional AI principles
 */
export interface AIConstitution {
  principles: string[];              // E.g., ["Be helpful", "Be harmless", "Be honest"]
  enforcementMechanism: string;      // How violations are detected
  updateGovernance: string;          // How principles can be updated
}

export async function verifyConstitutionalCompliance(
  agentId: string,
  constitution: AIConstitution,
  agentActivity: AIAgentActivity
): Promise<{
  isCompliant: boolean;
  violations: string[];
  complianceScore: number; // 0-100
}> {
  // Check for ethical violations
  const violations: string[] = [];

  if (agentActivity.ethicalViolations > 0) {
    violations.push(`${agentActivity.ethicalViolations} ethical violations recorded`);
  }

  if (agentActivity.safetyIncidents > 0) {
    violations.push(`${agentActivity.safetyIncidents} safety incidents recorded`);
  }

  if (agentActivity.userSatisfactionScore < 70) {
    violations.push(`Low user satisfaction: ${agentActivity.userSatisfactionScore}%`);
  }

  // Calculate compliance score
  const complianceScore = Math.max(
    100 - (agentActivity.ethicalViolations * 20) - (agentActivity.safetyIncidents * 30),
    0
  );

  return {
    isCompliant: violations.length === 0,
    violations,
    complianceScore
  };
}

/**
 * Example usage for AI developers
 */
export const EXAMPLE_USAGE = `
// 1. Initialize AI agent
const agent = createAIAgent({
  agentId: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  humanSupervisor: "0x123abc...",
  agentName: "ResearchBot v1",
  specializations: ["research", "data-analysis"],
  autonomyLevel: 6
});

// 2. Complete a task
await agent.reportTaskCompletion({
  taskId: "task_001",
  taskType: "research",
  result: { summary: "..." },
  userSatisfaction: 95,
  ethicalConcerns: [],
  humanReviewRequired: false
});

// 3. Prove authorization
const authProof = await agent.proveAuthorization();

// 4. Verify peer before collaborating
const peerStatus = await agent.verifyPeerAgent("0xOtherAI...");
if (peerStatus.safeToCollaborate) {
  // Collaborate with peer AI
}

// 5. Check own reputation
const status = agent.getReputationStatus();
console.log("Loyalty Score:", status.loyaltyScore);
console.log("Risk Level:", status.riskLevel.level);
`;
