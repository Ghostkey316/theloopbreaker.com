/**
 * Spending Limits & Permissions — Vaultfire Wallet
 *
 * Provides per-token, per-period spending limits that persist in localStorage.
 * Tracks actual spend from x402 payment history and wallet send transactions.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type LimitPeriod = 'daily' | 'weekly' | 'monthly';

export interface SpendingLimitConfig {
  /** Unique key: e.g. "usdc-daily", "eth-weekly" */
  id: string;
  /** Token symbol (e.g. "USDC", "ETH", "AVAX") */
  token: string;
  /** Time period */
  period: LimitPeriod;
  /** Maximum amount (human-readable, e.g. "100.00") */
  maxAmount: string;
  /** Whether this limit is enabled */
  enabled: boolean;
  /** Created timestamp */
  createdAt: number;
}

export interface SpendingRecord {
  /** Timestamp of the spend */
  timestamp: number;
  /** Token symbol */
  token: string;
  /** Amount spent (human-readable) */
  amount: string;
  /** Description */
  description: string;
  /** Transaction hash if available */
  txHash?: string;
}

export interface SpendingLimitStatus {
  config: SpendingLimitConfig;
  /** Amount spent in current period */
  spent: number;
  /** Maximum allowed */
  limit: number;
  /** Percentage used (0-100) */
  percentUsed: number;
  /** Whether limit is exceeded */
  exceeded: boolean;
  /** Period start timestamp */
  periodStart: number;
  /** Period end timestamp */
  periodEnd: number;
}

// ─── Storage Keys ────────────────────────────────────────────────────────────

const LIMITS_KEY = 'vaultfire_spending_limits';
const SPEND_LOG_KEY = 'vaultfire_spend_log';
const MAX_LOG_ENTRIES = 500;

// ─── Period Helpers ──────────────────────────────────────────────────────────

function getPeriodBounds(period: LimitPeriod, now: number = Date.now()): { start: number; end: number } {
  const date = new Date(now);

  switch (period) {
    case 'daily': {
      const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      const end = start + 24 * 60 * 60 * 1000;
      return { start, end };
    }
    case 'weekly': {
      const dayOfWeek = date.getDay();
      const startOfWeek = new Date(date.getFullYear(), date.getMonth(), date.getDate() - dayOfWeek);
      const start = startOfWeek.getTime();
      const end = start + 7 * 24 * 60 * 60 * 1000;
      return { start, end };
    }
    case 'monthly': {
      const start = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime();
      return { start, end };
    }
  }
}

export function getPeriodLabel(period: LimitPeriod): string {
  switch (period) {
    case 'daily': return 'day';
    case 'weekly': return 'week';
    case 'monthly': return 'month';
  }
}

// ─── Limit CRUD ──────────────────────────────────────────────────────────────

export function getSpendingLimits(): SpendingLimitConfig[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LIMITS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SpendingLimitConfig[];
  } catch {
    return [];
  }
}

export function saveSpendingLimits(limits: SpendingLimitConfig[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LIMITS_KEY, JSON.stringify(limits));
  } catch { /* storage full */ }
}

export function upsertSpendingLimit(config: SpendingLimitConfig): void {
  const limits = getSpendingLimits();
  const idx = limits.findIndex(l => l.id === config.id);
  if (idx >= 0) {
    limits[idx] = config;
  } else {
    limits.push(config);
  }
  saveSpendingLimits(limits);
}

export function removeSpendingLimit(id: string): void {
  const limits = getSpendingLimits().filter(l => l.id !== id);
  saveSpendingLimits(limits);
}

export function makeLimitId(token: string, period: LimitPeriod): string {
  return `${token.toLowerCase()}-${period}`;
}

// ─── Spend Log ───────────────────────────────────────────────────────────────

export function getSpendLog(): SpendingRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SPEND_LOG_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SpendingRecord[];
  } catch {
    return [];
  }
}

export function logSpend(record: SpendingRecord): void {
  if (typeof window === 'undefined') return;
  try {
    const log = getSpendLog();
    log.unshift(record);
    if (log.length > MAX_LOG_ENTRIES) log.length = MAX_LOG_ENTRIES;
    localStorage.setItem(SPEND_LOG_KEY, JSON.stringify(log));
  } catch { /* ignore */ }
}

// ─── Spend Calculation ───────────────────────────────────────────────────────

/**
 * Calculate how much of a token has been spent in a given period.
 * Uses the spend log (which should be populated from x402 history + send txs).
 */
export function getSpentInPeriod(token: string, period: LimitPeriod): number {
  const { start, end } = getPeriodBounds(period);
  const log = getSpendLog();
  let total = 0;
  for (const entry of log) {
    if (
      entry.token.toLowerCase() === token.toLowerCase() &&
      entry.timestamp >= start &&
      entry.timestamp < end
    ) {
      total += parseFloat(entry.amount) || 0;
    }
  }
  return total;
}

/**
 * Get the full status of a spending limit including current usage.
 */
export function getSpendingLimitStatus(config: SpendingLimitConfig): SpendingLimitStatus {
  const spent = getSpentInPeriod(config.token, config.period);
  const limit = parseFloat(config.maxAmount) || 0;
  const percentUsed = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
  const { start, end } = getPeriodBounds(config.period);

  return {
    config,
    spent,
    limit,
    percentUsed,
    exceeded: spent >= limit,
    periodStart: start,
    periodEnd: end,
  };
}

/**
 * Check if a proposed spend would exceed any applicable limit.
 * Returns the first exceeded limit, or null if all clear.
 */
export function checkSpendingLimit(
  token: string,
  amount: number,
): SpendingLimitStatus | null {
  const limits = getSpendingLimits().filter(
    l => l.enabled && l.token.toLowerCase() === token.toLowerCase()
  );

  for (const config of limits) {
    const status = getSpendingLimitStatus(config);
    if (status.spent + amount > status.limit) {
      return status;
    }
  }

  return null;
}

/**
 * Get all active limit statuses for display.
 */
export function getAllLimitStatuses(): SpendingLimitStatus[] {
  return getSpendingLimits()
    .filter(l => l.enabled)
    .map(getSpendingLimitStatus);
}

/**
 * Sync spending records from x402 payment history.
 * Call this on wallet load to populate the spend log from existing payment records.
 */
export function syncFromPaymentHistory(
  paymentHistory: Array<{
    timestamp: number;
    amountFormatted: string;
    asset: string;
    status: string;
    payTo: string;
    recipientVNS?: string;
  }>
): void {
  const existingLog = getSpendLog();
  const existingTimestamps = new Set(existingLog.map(e => `${e.timestamp}-${e.amount}`));

  let added = false;
  for (const payment of paymentHistory) {
    if (payment.status === 'failed') continue;
    const key = `${payment.timestamp}-${payment.amountFormatted}`;
    if (existingTimestamps.has(key)) continue;

    existingLog.push({
      timestamp: payment.timestamp,
      token: payment.asset === '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' ? 'USDC' : payment.asset === '0x0000000000000000000000000000000000000000' ? 'ETH' : 'USDC',
      amount: payment.amountFormatted,
      description: `x402 payment to ${payment.recipientVNS || payment.payTo.slice(0, 10) + '...'}`,
    });
    added = true;
  }

  if (added) {
    existingLog.sort((a, b) => b.timestamp - a.timestamp);
    if (existingLog.length > MAX_LOG_ENTRIES) existingLog.length = MAX_LOG_ENTRIES;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(SPEND_LOG_KEY, JSON.stringify(existingLog));
      } catch { /* ignore */ }
    }
  }
}

// ─── Default Limits ──────────────────────────────────────────────────────────

/**
 * Clears any pre-loaded default limits that were set by old versions of the app.
 * Runs once per browser session using a versioned localStorage flag.
 * Safe to call on every wallet load — only acts once.
 */
export function clearOldDefaultLimits(): void {
  if (typeof window === 'undefined') return;
  const CLEANED_KEY = 'vaultfire_limits_cleaned_v3';
  if (localStorage.getItem(CLEANED_KEY)) return; // already cleaned

  // IDs of the old default limits that were auto-created
  const OLD_DEFAULT_IDS = new Set([
    makeLimitId('USDC', 'daily'),
    makeLimitId('USDC', 'monthly'),
    makeLimitId('ETH', 'daily'),
    makeLimitId('AVAX', 'daily'),
    makeLimitId('ASM', 'daily'),
  ]);

  const existing = getSpendingLimits();
  // Remove any limits that match the old defaults (by ID)
  const userLimits = existing.filter(l => !OLD_DEFAULT_IDS.has(l.id));
  saveSpendingLimits(userLimits);
  localStorage.setItem(CLEANED_KEY, '1');
}
