import { createHash } from 'crypto';

export const GLASSPROOF_TRIGGER = 'Glassproof.';

export interface VerificationGasEvent {
  txHash: string;
  gasSpent: number;
}

export interface NonFungibleSignal {
  /** ISO timestamp or unix epoch of the builder's latest commit */
  commitTimestamp: string | number | Date;
  /** Historical gas spend for accountability */
  gasHistory: VerificationGasEvent[];
  /** Vault token balance must meet the 0.001 threshold */
  vaultTokenBalance: number;
  /** Optional Zora ID when a creator wants to link provenance */
  zoraId?: string;
}

export interface BuildProofInput {
  walletAddress: string;
  githubUsername: string;
  intentMessage: string;
  signal: NonFungibleSignal;
}

export interface SignalVerificationBreakdown {
  commitTimestampValid: boolean;
  commitRecencyScore: number;
  gasHistoryValid: boolean;
  averageGasSpend: number | null;
  vaultBalanceValid: boolean;
  zoraIdPresent: boolean;
}

export interface SignalVerificationResult {
  isValid: boolean;
  breakdown: SignalVerificationBreakdown;
  reasons: string[];
}

export interface BuildProof {
  fingerprint: string;
  issuedAt: string;
  verification: SignalVerificationResult;
}

const MAX_COMMIT_AGE_DAYS = 30;
const MIN_VAULT_BALANCE = 0.001;

function normaliseAddress(address: string): string {
  return address.trim().toLowerCase();
}

function toEpochMillis(value: string | number | Date): number {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === 'number') {
    return value;
  }

  const parsed = new Date(value);
  const epoch = parsed.getTime();

  if (Number.isNaN(epoch)) {
    throw new Error('Invalid commit timestamp provided.');
  }

  return epoch;
}

function calculateCommitRecencyScore(commitEpoch: number, referenceEpoch: number): number {
  const millisecondsPerDay = 86_400_000;
  const ageInDays = (referenceEpoch - commitEpoch) / millisecondsPerDay;
  if (ageInDays <= 0) {
    return 1;
  }
  if (ageInDays >= MAX_COMMIT_AGE_DAYS) {
    return 0;
  }

  return 1 - ageInDays / MAX_COMMIT_AGE_DAYS;
}

function calculateAverageGasSpend(gasHistory: VerificationGasEvent[]): number | null {
  if (!gasHistory.length) {
    return null;
  }

  const total = gasHistory.reduce((sum, { gasSpent }) => sum + gasSpent, 0);
  return total / gasHistory.length;
}

export function verifyNonFungibleSignal(signal: NonFungibleSignal, now: Date = new Date()): SignalVerificationResult {
  const reasons: string[] = [];

  let commitEpoch: number;
  try {
    commitEpoch = toEpochMillis(signal.commitTimestamp);
  } catch (error) {
    reasons.push(error instanceof Error ? error.message : 'Invalid commit timestamp.');
    return {
      isValid: false,
      breakdown: {
        commitTimestampValid: false,
        commitRecencyScore: 0,
        gasHistoryValid: signal.gasHistory.length > 0,
        averageGasSpend: calculateAverageGasSpend(signal.gasHistory),
        vaultBalanceValid: signal.vaultTokenBalance >= MIN_VAULT_BALANCE,
        zoraIdPresent: Boolean(signal.zoraId),
      },
      reasons,
    };
  }

  const nowEpoch = now.getTime();
  const commitRecencyScore = calculateCommitRecencyScore(commitEpoch, nowEpoch);
  const commitTimestampValid = commitRecencyScore > 0;
  if (!commitTimestampValid) {
    reasons.push('Commit timestamp is too old to signal active building.');
  }

  const gasHistoryValid = signal.gasHistory.every(({ txHash, gasSpent }) =>
    Boolean(txHash) && Number.isFinite(gasSpent) && gasSpent > 0,
  );
  if (!gasHistoryValid) {
    reasons.push('Gas history must contain positive values and transaction hashes.');
  } else if (signal.gasHistory.length === 0) {
    reasons.push('No gas history provided for verification.');
  }

  const vaultBalanceValid = signal.vaultTokenBalance >= MIN_VAULT_BALANCE;
  if (!vaultBalanceValid) {
    reasons.push(`Vault token balance must be at least ${MIN_VAULT_BALANCE}.`);
  }

  const averageGasSpend = calculateAverageGasSpend(signal.gasHistory);
  const zoraIdPresent = Boolean(signal.zoraId);

  const isValid = commitTimestampValid && gasHistoryValid && signal.gasHistory.length > 0 && vaultBalanceValid;

  return {
    isValid,
    breakdown: {
      commitTimestampValid,
      commitRecencyScore,
      gasHistoryValid,
      averageGasSpend,
      vaultBalanceValid,
      zoraIdPresent,
    },
    reasons,
  };
}

export function createFingerprint(payload: BuildProofInput): string {
  const { walletAddress, githubUsername, intentMessage, signal } = payload;
  const commitTimestamp = toEpochMillis(signal.commitTimestamp);
  const averageGas = calculateAverageGasSpend(signal.gasHistory) ?? 0;

  const raw = [
    normaliseAddress(walletAddress),
    githubUsername.trim().toLowerCase(),
    intentMessage.trim(),
    commitTimestamp.toString(),
    averageGas.toFixed(8),
    signal.vaultTokenBalance.toFixed(12),
    signal.zoraId?.trim().toLowerCase() ?? 'none',
  ].join('|');

  return createHash('sha256').update(raw).digest('hex');
}

export function createBuildProof(input: BuildProofInput, now: Date = new Date()): BuildProof {
  const verification = verifyNonFungibleSignal(input.signal, now);
  const fingerprint = createFingerprint(input);

  return {
    fingerprint,
    issuedAt: now.toISOString(),
    verification,
  };
}

export function formatProofForDisplay(proof: BuildProof): string {
  const { fingerprint, issuedAt, verification } = proof;
  const status = verification.isValid ? 'VERIFIED' : 'REQUIRES REVIEW';

  return [
    `Status: ${status}`,
    `Fingerprint: ${fingerprint}`,
    `Issued At: ${issuedAt}`,
    `Commit Recency Score: ${verification.breakdown.commitRecencyScore.toFixed(2)}`,
    `Average Gas Spend: ${verification.breakdown.averageGasSpend ?? 'N/A'}`,
    verification.breakdown.zoraIdPresent ? 'Zora ID linked.' : 'No Zora ID provided.',
    verification.reasons.length ? `Flags: ${verification.reasons.join('; ')}` : 'All checks passed.',
  ].join('\n');
}
