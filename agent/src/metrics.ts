/**
 * Vaultfire Agent — Metrics Reporting
 *
 * Handles interaction with the FlourishingMetricsOracle contract
 * for self-reporting performance metrics and reading protocol state.
 */

import { ethers } from 'ethers';
import { AgentConfig, CONTRACTS, METRIC_IDS } from './config';
import { FlourishingMetricsOracleABI } from './abi';
import { AgentWallet } from './wallet';
import { Logger } from './logger';
import { withRetry } from './retry';

const log = new Logger('Metrics');

export interface OracleRound {
  roundId: number;
  metricId: string;
  startTime: number;
  deadline: number;
  consensusValue: number;
  finalized: boolean;
  submissionCount: number;
}

export interface MetricValue {
  value: number;
  roundId: number;
}

/**
 * Get the FlourishingMetricsOracle contract instance.
 */
function getOracleContract(wallet: AgentWallet): ethers.Contract {
  return new ethers.Contract(
    CONTRACTS.FlourishingMetricsOracle,
    FlourishingMetricsOracleABI,
    wallet.signer,
  );
}

/**
 * Compute the bytes32 metric ID from a human-readable string.
 */
export function computeMetricId(name: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(name));
}

/**
 * Check if the agent is a registered oracle.
 */
export async function isAgentOracle(wallet: AgentWallet): Promise<boolean> {
  const oracle = getOracleContract(wallet);
  try {
    return await oracle.isOracle(wallet.address);
  } catch {
    return false;
  }
}

/**
 * Get the list of registered oracles.
 */
export async function getOracles(wallet: AgentWallet): Promise<string[]> {
  const oracle = getOracleContract(wallet);
  return oracle.getOracles();
}

/**
 * Get the oracle owner address.
 */
export async function getOracleOwner(wallet: AgentWallet): Promise<string> {
  const oracle = getOracleContract(wallet);
  return oracle.owner();
}

/**
 * Get the latest value for a metric.
 */
export async function getLatestMetricValue(
  wallet: AgentWallet,
  metricName: string,
): Promise<MetricValue | null> {
  const oracle = getOracleContract(wallet);
  const metricId = computeMetricId(metricName);

  try {
    const [value, roundId] = await oracle.getLatestValue(metricId);
    return { value: Number(value), roundId: Number(roundId) };
  } catch {
    return null;
  }
}

/**
 * Get round details by ID.
 */
export async function getRound(wallet: AgentWallet, roundId: number): Promise<OracleRound | null> {
  const oracle = getOracleContract(wallet);

  try {
    const round = await oracle.getRound(roundId);
    return {
      roundId: Number(round.roundId),
      metricId: round.metricId,
      startTime: Number(round.startTime),
      deadline: Number(round.deadline),
      consensusValue: Number(round.consensusValue),
      finalized: round.finalized,
      submissionCount: Number(round.submissionCount),
    };
  } catch {
    return null;
  }
}

/**
 * Get the next round ID (total rounds created).
 */
export async function getNextRoundId(wallet: AgentWallet): Promise<number> {
  const oracle = getOracleContract(wallet);
  const next = await oracle.nextRoundId();
  return Number(next);
}

/**
 * Submit a metric value to an active oracle round.
 * Only works if the agent is a registered oracle.
 */
export async function submitMetric(
  wallet: AgentWallet,
  config: AgentConfig,
  roundId: number,
  value: number,
): Promise<string | null> {
  if (config.dryRun) {
    log.info('[DRY RUN] Would submit metric', { roundId, value });
    return null;
  }

  const oracle = getOracleContract(wallet);

  // Check if already submitted
  const alreadySubmitted = await oracle.hasSubmitted(roundId, wallet.address);
  if (alreadySubmitted) {
    log.info('Already submitted metric for this round', { roundId });
    return null;
  }

  const tx = await withRetry(
    () => oracle.submitMetric(roundId, value),
    config.maxRetries,
    config.retryDelayMs,
    log,
    'submitMetric',
  );

  const receipt = await tx.wait();
  log.info('Metric submitted to oracle', { roundId, value, txHash: receipt.hash });
  return receipt.hash;
}

/**
 * Attempt to report metrics. If the agent is an oracle, it can submit directly.
 * Otherwise, it logs the metrics for off-chain reporting.
 */
export async function reportMetrics(
  wallet: AgentWallet,
  config: AgentConfig,
  metricsData: Record<string, number>,
): Promise<void> {
  const isOracle = await isAgentOracle(wallet);

  if (!isOracle) {
    log.info('Agent is not a registered oracle — logging metrics off-chain', {
      metrics: metricsData,
      note: 'Oracle owner must call addOracle() with agent address to enable on-chain metric submission',
    });

    // Log all metric values for transparency even when not an oracle
    for (const [name, value] of Object.entries(metricsData)) {
      const metricId = computeMetricId(name);
      log.info('Metric computed (off-chain)', { name, metricId, value });
    }
    return;
  }

  log.info('Agent is a registered oracle — checking for active rounds');

  // Check each metric for active rounds
  for (const [name, value] of Object.entries(metricsData)) {
    const metricId = computeMetricId(name);
    const latestValue = await getLatestMetricValue(wallet, name);

    log.info('Metric status', {
      name,
      metricId,
      currentValue: latestValue?.value ?? 'none',
      newValue: value,
    });
  }
}

/**
 * Collect all available metric IDs and their latest values.
 */
export async function collectAllMetrics(
  wallet: AgentWallet,
): Promise<Record<string, MetricValue | null>> {
  const results: Record<string, MetricValue | null> = {};

  for (const [key, name] of Object.entries(METRIC_IDS)) {
    results[key] = await getLatestMetricValue(wallet, name);
  }

  return results;
}
