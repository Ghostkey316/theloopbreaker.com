"""Vaultfire LoyaltyMesh v1.0 core reward engine."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Iterable, Mapping, Sequence


@dataclass(frozen=True)
class LoyaltyMultiplier:
    """Represents the calculated multiplier for a validator at a moment in time."""

    validator_id: str
    pop_tier: int
    belief_sync_streak: int
    recall_precision: float
    base_multiplier: float
    streak_amplifier: float
    recall_penalty: float
    net_multiplier: float
    timestamp: datetime


class LoyaltyEngine:
    """Compute reward multipliers combining PoP, BeliefSync, and recall fidelity."""

    # Base reward tiers anchored to PoP scores. These thresholds align with the
    # PoP engine's tier schema (0-3) but allow for future Sovereign expansion.
    DEFAULT_TIER_MULTIPLIERS: Mapping[int, float] = {
        0: 0.9,
        1: 1.0,
        2: 1.15,
        3: 1.35,
        4: 1.5,
    }

    def __init__(
        self,
        *,
        tier_multipliers: Mapping[int, float] | None = None,
        max_streak_bonus: float = 0.35,
        streak_half_life_days: float = 7.0,
        recall_decay: float = 0.85,
        recall_penalty_span: float = 0.35,
        clock: callable | None = None,
    ) -> None:
        self.tier_multipliers: Mapping[int, float] = tier_multipliers or self.DEFAULT_TIER_MULTIPLIERS
        self.max_streak_bonus = max_streak_bonus
        self.streak_half_life_days = max(1.0, streak_half_life_days)
        self.recall_decay = min(0.99, max(0.1, recall_decay))
        self.recall_penalty_span = max(0.0, min(1.0, recall_penalty_span))
        self._clock = clock or datetime.utcnow

    def _clock_now(self) -> datetime:
        return self._clock()

    def _base_from_pop(self, pop_tier: int) -> float:
        tier = max(0, pop_tier)
        if tier in self.tier_multipliers:
            return self.tier_multipliers[tier]
        highest_tier = max(self.tier_multipliers)
        if tier > highest_tier:
            return self.tier_multipliers[highest_tier] + 0.05 * (tier - highest_tier)
        return self.tier_multipliers.get(tier, self.tier_multipliers[0])

    def _streak_amplifier(self, streak_days: int) -> float:
        streak = max(0, streak_days)
        # Time-weighted streak scaling using a half-life curve to avoid runaway growth.
        streak_ratio = 1 - (0.5 ** (streak / self.streak_half_life_days))
        return round(1.0 + min(self.max_streak_bonus, self.max_streak_bonus * streak_ratio), 4)

    def _weighted_recall_precision(self, history: Sequence[float | bool] | None) -> float:
        values: Sequence[float | bool] = history or []
        if not values:
            return 1.0

        weighted_sum = 0.0
        weight_total = 0.0
        for idx, entry in enumerate(reversed(values)):
            weight = self.recall_decay ** idx
            precision = 1.0 if isinstance(entry, bool) and entry else float(entry)
            precision = max(0.0, min(1.0, precision))
            weighted_sum += precision * weight
            weight_total += weight
        return weighted_sum / max(weight_total, 1e-6)

    def _recall_penalty(self, precision: float) -> float:
        miss_ratio = max(0.0, min(1.0, 1.0 - precision))
        penalty = 1.0 - miss_ratio * self.recall_penalty_span
        return round(max(0.6, penalty), 4)

    def calculate_multiplier(
        self,
        validator_id: str,
        *,
        pop_tier: int,
        belief_sync_streak: int = 0,
        recall_precision: float | None = None,
        recall_history: Sequence[float | bool] | None = None,
    ) -> LoyaltyMultiplier:
        if not validator_id:
            raise ValueError("validator_id is required")

        timestamp = self._clock_now()
        base_multiplier = self._base_from_pop(pop_tier)
        streak_amplifier = self._streak_amplifier(belief_sync_streak)
        effective_precision = (
            max(0.0, min(1.0, recall_precision)) if recall_precision is not None else None
        )
        if effective_precision is None:
            effective_precision = self._weighted_recall_precision(recall_history)
        recall_penalty = self._recall_penalty(effective_precision)

        net_multiplier = round(base_multiplier * streak_amplifier * recall_penalty, 4)

        return LoyaltyMultiplier(
            validator_id=validator_id,
            pop_tier=pop_tier,
            belief_sync_streak=belief_sync_streak,
            recall_precision=effective_precision,
            base_multiplier=base_multiplier,
            streak_amplifier=streak_amplifier,
            recall_penalty=recall_penalty,
            net_multiplier=net_multiplier,
            timestamp=timestamp,
        )

    @staticmethod
    def classify_yield_class(multiplier: float) -> str:
        if multiplier >= 1.45:
            return "Sovereign"
        if multiplier >= 1.25:
            return "Gold"
        if multiplier >= 1.05:
            return "Silver"
        return "Bronze"

    def rollup_validators(
        self,
        validators: Iterable[Mapping[str, object]],
    ) -> list[LoyaltyMultiplier]:
        rollups: list[LoyaltyMultiplier] = []
        for validator in validators:
            result = self.calculate_multiplier(
                str(validator.get("validator_id")),
                pop_tier=int(validator.get("pop_tier", 0)),
                belief_sync_streak=int(validator.get("belief_sync_streak", 0)),
                recall_precision=(
                    float(validator["recall_precision"]) if "recall_precision" in validator else None
                ),
                recall_history=validator.get("recall_history")
                if isinstance(validator.get("recall_history"), Sequence)
                else None,
            )
            rollups.append(result)
        return rollups
