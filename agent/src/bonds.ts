/**
 * Vaultfire Agent — Partnership Bond Management
 *
 * Handles creation, discovery, and management of AIPartnershipBondsV2
 * linking this agent to its human partner.
 */

import { ethers } from 'ethers';
import { AgentConfig, CONTRACTS } from './config';
import { AIPartnershipBondsV2ABI } from './abi';
import { AgentWallet } from './wallet';
import { Logger } from './logger';
import { withRetry } from './retry';

const log = new Logger('Bonds');

export interface BondInfo {
  bondId: number;
  human: string;
  aiAgent: string;
  partnershipType: string;
  stakeAmount: bigint;
  createdAt: number;
  active: boolean;
}

export interface ProtocolHealth {
  isHealthy: boolean;
  yieldPoolOK: boolean;
  reserveRatioOK: boolean;
  currentRatio: number;
}

/**
 * Get the AIPartnershipBondsV2 contract instance.
 */
function getBondsContract(wallet: AgentWallet): ethers.Contract {
  return new ethers.Contract(
    CONTRACTS.AIPartnershipBondsV2,
    AIPartnershipBondsV2ABI,
    wallet.signer,
  );
}

/**
 * Find existing bonds between this agent and the human partner.
 */
export async function findExistingBonds(
  wallet: AgentWallet,
  humanPartnerAddress: string,
): Promise<BondInfo[]> {
  const bonds = getBondsContract(wallet);
  const results: BondInfo[] = [];

  try {
    // Check bonds for the agent address
    const agentBondIds: bigint[] = await bonds.getBondsByParticipant(wallet.address);

    for (const bondIdBig of agentBondIds) {
      try {
        const bond = await bonds.getBond(bondIdBig);
        const info: BondInfo = {
          bondId: Number(bond.bondId),
          human: bond.human,
          aiAgent: bond.aiAgent,
          partnershipType: bond.partnershipType,
          stakeAmount: bond.stakeAmount,
          createdAt: Number(bond.createdAt),
          active: bond.active,
        };

        // Only include bonds that link this agent to the specified human partner
        if (
          info.aiAgent.toLowerCase() === wallet.address.toLowerCase() &&
          info.human.toLowerCase() === humanPartnerAddress.toLowerCase()
        ) {
          results.push(info);
        }
      } catch (err) {
        log.debug('Could not fetch bond details', {
          bondId: bondIdBig.toString(),
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } catch (err) {
    log.debug('Could not fetch bonds for participant', {
      address: wallet.address,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return results;
}

/**
 * Ensure a partnership bond exists between the agent and its human partner.
 * If one already exists and is active, returns it. Otherwise, the bond must
 * be created by the human partner (since createBond is called by the human
 * with the AI agent address as a parameter).
 */
export async function ensureBond(
  wallet: AgentWallet,
  config: AgentConfig,
): Promise<{ bondId: number | null; action: 'existing' | 'needs-creation' | 'dry-run' }> {
  const existingBonds = await findExistingBonds(wallet, config.humanPartnerAddress);
  const activeBond = existingBonds.find((b) => b.active);

  if (activeBond) {
    log.info('Active partnership bond found', {
      bondId: activeBond.bondId,
      human: activeBond.human,
      aiAgent: activeBond.aiAgent,
      partnershipType: activeBond.partnershipType,
      createdAt: new Date(activeBond.createdAt * 1000).toISOString(),
    });
    return { bondId: activeBond.bondId, action: 'existing' };
  }

  if (config.dryRun) {
    log.info('[DRY RUN] No active bond found — would need human partner to create one', {
      humanPartner: config.humanPartnerAddress,
      agentAddress: wallet.address,
    });
    return { bondId: null, action: 'dry-run' };
  }

  // The createBond function is payable and called by the human (msg.sender = human).
  // The agent cannot create its own bond — it must be initiated by the human partner.
  log.info('No active partnership bond found. The human partner must create the bond.', {
    humanPartner: config.humanPartnerAddress,
    agentAddress: wallet.address,
    instruction: `Human partner should call createBond("${wallet.address}", "trust-partnership") on AIPartnershipBondsV2`,
  });

  return { bondId: null, action: 'needs-creation' };
}

/**
 * Submit partnership metrics for an active bond.
 */
export async function submitPartnershipMetrics(
  wallet: AgentWallet,
  config: AgentConfig,
  bondId: number,
  metrics: {
    humanGrowth: number;
    humanAutonomy: number;
    humanDignity: number;
    tasksMastered: number;
    creativityScore: number;
    progressNotes: string;
  },
): Promise<string | null> {
  if (config.dryRun) {
    log.info('[DRY RUN] Would submit partnership metrics', { bondId, ...metrics });
    return null;
  }

  const bonds = getBondsContract(wallet);

  const tx = await withRetry(
    () =>
      bonds.submitPartnershipMetrics(
        bondId,
        metrics.humanGrowth,
        metrics.humanAutonomy,
        metrics.humanDignity,
        metrics.tasksMastered,
        metrics.creativityScore,
        metrics.progressNotes,
      ),
    config.maxRetries,
    config.retryDelayMs,
    log,
    'submitPartnershipMetrics',
  );

  const receipt = await tx.wait();
  log.info('Partnership metrics submitted', { bondId, txHash: receipt.hash });
  return receipt.hash;
}

/**
 * Fetch the current protocol health status.
 */
export async function getProtocolHealth(wallet: AgentWallet): Promise<ProtocolHealth> {
  const bonds = getBondsContract(wallet);
  const [isHealthy, yieldPoolOK, reserveRatioOK, currentRatio] = await bonds.getProtocolHealth();
  return {
    isHealthy,
    yieldPoolOK,
    reserveRatioOK,
    currentRatio: Number(currentRatio),
  };
}

/**
 * Get the yield pool balance.
 */
export async function getYieldPoolBalance(wallet: AgentWallet): Promise<bigint> {
  const bonds = getBondsContract(wallet);
  return bonds.getYieldPoolBalance();
}

/**
 * Get the total number of bonds created.
 */
export async function getNextBondId(wallet: AgentWallet): Promise<number> {
  const bonds = getBondsContract(wallet);
  const next = await bonds.nextBondId();
  return Number(next);
}

/**
 * Get the total active bond value.
 */
export async function getTotalActiveBondValue(wallet: AgentWallet): Promise<bigint> {
  const bonds = getBondsContract(wallet);
  return bonds.totalActiveBondValue();
}

/**
 * Check if the bonds contract is paused.
 */
export async function isBondsPaused(wallet: AgentWallet): Promise<boolean> {
  const bonds = getBondsContract(wallet);
  return bonds.isPaused();
}

/**
 * Get the partnership quality score for a bond.
 */
export async function getPartnershipQualityScore(
  wallet: AgentWallet,
  bondId: number,
): Promise<number> {
  const bonds = getBondsContract(wallet);
  const score = await bonds.partnershipQualityScore(bondId);
  return Number(score);
}
