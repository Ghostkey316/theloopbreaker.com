/**
 * Embris by Vaultfire — Spending Limits (Mobile)
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SpendingLimit {
  daily: number;
  weekly: number;
  monthly: number;
  perTransaction: number;
  enabled: boolean;
  updatedAt: number;
}

export interface SpendingUsage {
  dailyUsed: number;
  weeklyUsed: number;
  monthlyUsed: number;
  lastResetDaily: number;
  lastResetWeekly: number;
  lastResetMonthly: number;
}

const LIMITS_KEY = 'vaultfire_spending_limits';
const USAGE_KEY = 'vaultfire_spending_usage';

const DEFAULT_LIMITS: SpendingLimit = {
  daily: 1.0,
  weekly: 5.0,
  monthly: 20.0,
  perTransaction: 0.5,
  enabled: false,
  updatedAt: 0,
};

export async function getSpendingLimits(): Promise<SpendingLimit> {
  try {
    const raw = await AsyncStorage.getItem(LIMITS_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_LIMITS;
  } catch { return DEFAULT_LIMITS; }
}

export async function saveSpendingLimits(limits: SpendingLimit): Promise<void> {
  await AsyncStorage.setItem(LIMITS_KEY, JSON.stringify({ ...limits, updatedAt: Date.now() }));
}

export async function getSpendingUsage(): Promise<SpendingUsage> {
  try {
    const raw = await AsyncStorage.getItem(USAGE_KEY);
    if (!raw) return { dailyUsed: 0, weeklyUsed: 0, monthlyUsed: 0, lastResetDaily: Date.now(), lastResetWeekly: Date.now(), lastResetMonthly: Date.now() };
    return JSON.parse(raw);
  } catch {
    return { dailyUsed: 0, weeklyUsed: 0, monthlyUsed: 0, lastResetDaily: Date.now(), lastResetWeekly: Date.now(), lastResetMonthly: Date.now() };
  }
}

export async function checkSpendingLimit(amount: number): Promise<{ allowed: boolean; reason?: string }> {
  const limits = await getSpendingLimits();
  if (!limits.enabled) return { allowed: true };

  if (amount > limits.perTransaction) {
    return { allowed: false, reason: `Exceeds per-transaction limit of ${limits.perTransaction} ETH` };
  }

  const usage = await getSpendingUsage();
  if (usage.dailyUsed + amount > limits.daily) {
    return { allowed: false, reason: `Would exceed daily limit of ${limits.daily} ETH` };
  }
  if (usage.weeklyUsed + amount > limits.weekly) {
    return { allowed: false, reason: `Would exceed weekly limit of ${limits.weekly} ETH` };
  }
  if (usage.monthlyUsed + amount > limits.monthly) {
    return { allowed: false, reason: `Would exceed monthly limit of ${limits.monthly} ETH` };
  }

  return { allowed: true };
}
