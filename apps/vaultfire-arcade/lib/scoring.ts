export type GuardianTag = "ethics" | "greed" | "privacy" | "loyalty" | "fear";

export interface VaultfireAction {
  id: string;
  title: string;
  description: string;
  tags: GuardianTag[];
  category: string;
}

export interface VaultfireState {
  beliefScore: number;
  ethicsAlignment: number;
  privacyShield: number;
  loyaltyStreak: number;
}

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const tagEffects: Record<GuardianTag, Partial<VaultfireState>> = {
  ethics: { beliefScore: 2, ethicsAlignment: 8 },
  greed: { beliefScore: -4, loyaltyStreak: -6 },
  privacy: { privacyShield: 7, ethicsAlignment: 2 },
  loyalty: { loyaltyStreak: 8, beliefScore: 3 },
  fear: { beliefScore: -3, ethicsAlignment: -2 },
};

export function applyAction(state: VaultfireState, action: VaultfireAction): VaultfireState {
  const aggregate = action.tags.reduce(
    (acc, tag) => {
      const delta = tagEffects[tag];
      return {
        beliefScore: acc.beliefScore + (delta.beliefScore ?? 0),
        ethicsAlignment: acc.ethicsAlignment + (delta.ethicsAlignment ?? 0),
        privacyShield: acc.privacyShield + (delta.privacyShield ?? 0),
        loyaltyStreak: acc.loyaltyStreak + (delta.loyaltyStreak ?? 0),
      };
    },
    { ...state }
  );

  return {
    beliefScore: clamp(aggregate.beliefScore),
    ethicsAlignment: clamp(aggregate.ethicsAlignment),
    privacyShield: clamp(aggregate.privacyShield),
    loyaltyStreak: clamp(aggregate.loyaltyStreak),
  };
}

export function projectYield(state: VaultfireState): { min: number; max: number } {
  const weights = {
    beliefScore: 0.28,
    ethicsAlignment: 0.27,
    privacyShield: 0.22,
    loyaltyStreak: 0.23,
  };

  const weighted =
    state.beliefScore * weights.beliefScore +
    state.ethicsAlignment * weights.ethicsAlignment +
    state.privacyShield * weights.privacyShield +
    state.loyaltyStreak * weights.loyaltyStreak;

  const min = Math.max(0, Math.round(weighted * 0.6));
  const max = Math.min(120, Math.round(weighted * 1.15));

  return { min, max };
}
