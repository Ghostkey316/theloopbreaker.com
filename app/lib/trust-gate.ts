/**
 * Trust-Gated Transactions — Vaultfire Wallet
 *
 * Configures minimum bond tier requirements for outgoing payments.
 * Persists settings in localStorage.
 */

import { type BondTier, BOND_TIERS, getBondTierInfo } from './vns';

// ─── Types ───────────────────────────────────────────────────────────────────

export type TrustGateLevel = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum';

export interface TrustGateConfig {
  /** Minimum bond tier required for outgoing payments */
  minimumTier: TrustGateLevel;
  /** Whether trust gating is enabled */
  enabled: boolean;
  /** Updated timestamp */
  updatedAt: number;
}

export interface TrustGateCheckResult {
  /** Whether the transaction is allowed */
  allowed: boolean;
  /** The required tier */
  requiredTier: TrustGateLevel;
  /** The recipient's actual tier (if known) */
  recipientTier?: BondTier;
  /** Human-readable message */
  message: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TRUST_GATE_KEY = 'vaultfire_trust_gate';

export const TRUST_GATE_LEVELS: { value: TrustGateLevel; label: string; color: string; description: string }[] = [
  { value: 'none', label: 'None', color: '#71717A', description: 'No trust requirement — pay anyone' },
  { value: 'bronze', label: 'Bronze', color: '#CD7F32', description: 'Minimum 0.01 ETH bond' },
  { value: 'silver', label: 'Silver', color: '#C0C0C0', description: 'Minimum 0.05 ETH bond' },
  { value: 'gold', label: 'Gold', color: '#FFD700', description: 'Minimum 0.1 ETH bond' },
  { value: 'platinum', label: 'Platinum', color: '#E5E4E2', description: 'Minimum 0.5 ETH bond' },
];

const TIER_RANK: Record<TrustGateLevel, number> = {
  none: 0,
  bronze: 1,
  silver: 2,
  gold: 3,
  platinum: 4,
};

// ─── Config CRUD ─────────────────────────────────────────────────────────────

export function getTrustGateConfig(): TrustGateConfig {
  if (typeof window === 'undefined') {
    return { minimumTier: 'none', enabled: false, updatedAt: 0 };
  }
  try {
    const raw = localStorage.getItem(TRUST_GATE_KEY);
    if (!raw) return { minimumTier: 'none', enabled: false, updatedAt: 0 };
    return JSON.parse(raw) as TrustGateConfig;
  } catch {
    return { minimumTier: 'none', enabled: false, updatedAt: 0 };
  }
}

export function saveTrustGateConfig(config: TrustGateConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TRUST_GATE_KEY, JSON.stringify(config));
  } catch { /* storage full */ }
}

export function setTrustGateLevel(level: TrustGateLevel): void {
  saveTrustGateConfig({
    minimumTier: level,
    enabled: level !== 'none',
    updatedAt: Date.now(),
  });
}

// ─── Trust Check ─────────────────────────────────────────────────────────────

/**
 * Check if a transaction to a recipient meets the trust gate requirements.
 *
 * @param recipientTier - The bond tier of the recipient (from VNS profile), or undefined if unknown
 * @returns TrustGateCheckResult
 */
export function checkTrustGate(recipientTier?: BondTier): TrustGateCheckResult {
  const config = getTrustGateConfig();

  // If trust gating is disabled, always allow
  if (!config.enabled || config.minimumTier === 'none') {
    return {
      allowed: true,
      requiredTier: 'none',
      recipientTier,
      message: 'No trust requirement set.',
    };
  }

  // If recipient tier is unknown, warn but don't block
  if (!recipientTier) {
    return {
      allowed: false,
      requiredTier: config.minimumTier,
      recipientTier: undefined,
      message: `Trust gate requires ${config.minimumTier} tier or higher. Recipient has no verified bond.`,
    };
  }

  const requiredRank = TIER_RANK[config.minimumTier];
  const recipientRank = TIER_RANK[recipientTier] || 0;

  if (recipientRank >= requiredRank) {
    const tierInfo = getBondTierInfo(recipientTier);
    return {
      allowed: true,
      requiredTier: config.minimumTier,
      recipientTier,
      message: `Recipient meets trust requirement (${tierInfo.label} tier).`,
    };
  }

  const requiredInfo = TRUST_GATE_LEVELS.find(l => l.value === config.minimumTier);
  return {
    allowed: false,
    requiredTier: config.minimumTier,
    recipientTier,
    message: `Recipient's ${recipientTier} tier is below your ${requiredInfo?.label || config.minimumTier} minimum requirement.`,
  };
}

/**
 * Get the color for a trust gate level.
 */
export function getTrustGateColor(level: TrustGateLevel): string {
  return TRUST_GATE_LEVELS.find(l => l.value === level)?.color || '#71717A';
}

/**
 * Get the label for a trust gate level.
 */
export function getTrustGateLabel(level: TrustGateLevel): string {
  return TRUST_GATE_LEVELS.find(l => l.value === level)?.label || 'None';
}
