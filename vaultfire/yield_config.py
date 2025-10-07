from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Sequence

__all__ = [
    "YieldTier",
    "EpochConfig",
    "RetroYieldConfig",
]


@dataclass(frozen=True)
class YieldTier:
    """Configuration container describing a loyalty tier."""

    name: str
    min_loyalty: int
    base_rate: float
    bonus_multiplier: float = 1.0


@dataclass(frozen=True)
class EpochConfig:
    """Time boxed reward window used for decay calculations."""

    index: int
    start: datetime
    end: datetime
    decay: float


class RetroYieldConfig:
    """Resolve scaling factors for Vaultfire RetroYield computations."""

    DEFAULT_START = datetime(2025, 1, 1, tzinfo=timezone.utc)

    def __init__(
        self,
        *,
        tiers: Sequence[YieldTier] | None = None,
        epoch_length: timedelta = timedelta(days=30),
        base_reward: float = 15.0,
        ghostkey_bonus: float = 0.12,
        streak_grace: timedelta = timedelta(hours=36),
    ) -> None:
        if epoch_length.total_seconds() <= 0:
            raise ValueError("epoch_length must be positive")
        self._tiers = tuple(sorted(tiers or _default_tiers(), key=lambda tier: tier.min_loyalty))
        if not self._tiers:
            raise ValueError("at least one tier must be configured")
        self._epoch_length = epoch_length
        self._base_reward = float(base_reward)
        self._ghostkey_bonus = float(ghostkey_bonus)
        self._streak_grace = streak_grace
        self._epoch_zero = self.DEFAULT_START

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------
    @property
    def base_reward(self) -> float:
        return self._base_reward

    @property
    def streak_grace(self) -> timedelta:
        return self._streak_grace

    # ------------------------------------------------------------------
    # Tier helpers
    # ------------------------------------------------------------------
    def tier_for(self, loyalty_streak: int) -> YieldTier:
        """Return the highest tier satisfied by ``loyalty_streak``."""

        streak = max(int(loyalty_streak), 0)
        chosen = self._tiers[0]
        for tier in self._tiers:
            if streak >= tier.min_loyalty:
                chosen = tier
            else:
                break
        return chosen

    # ------------------------------------------------------------------
    # Epoch helpers
    # ------------------------------------------------------------------
    def epoch_for(self, at: datetime | None = None) -> EpochConfig:
        """Return the epoch configuration for ``at``."""

        moment = _coerce_datetime(at)
        delta = moment - self._epoch_zero
        index = max(int(delta.total_seconds() // self._epoch_length.total_seconds()), 0)
        start = self._epoch_zero + self._epoch_length * index
        end = start + self._epoch_length
        decay = min(0.5, index * 0.05)
        return EpochConfig(index=index, start=start, end=end, decay=decay)

    # ------------------------------------------------------------------
    # Scaling helpers
    # ------------------------------------------------------------------
    def update_streak(
        self,
        last_action: datetime | None,
        current_action: datetime,
        current_streak: int,
    ) -> int:
        """Return the next streak value using the configured grace window."""

        current_action = _coerce_datetime(current_action)
        if last_action is None:
            return 1
        last_action = _coerce_datetime(last_action)
        if current_action.date() == last_action.date():
            return current_streak
        if current_action - last_action <= self._streak_grace:
            return max(current_streak, 0) + 1
        return 1

    def behavior_multiplier(self, loyalty_streak: int, *, base: float = 1.0) -> float:
        """Return a deterministic multiplier derived from the loyalty streak."""

        ramp = min(max(int(loyalty_streak), 0), 10)
        return round(base + ramp * 0.05, 4)

    def scale_reward(
        self,
        *,
        loyalty_streak: int,
        behavior_multiplier: float,
        ghostkey_confirmed: bool,
        issued_at: datetime | None = None,
        weight: float = 1.0,
    ) -> float:
        """Return the scaled reward amount for the provided context."""

        tier = self.tier_for(loyalty_streak)
        epoch = self.epoch_for(issued_at)
        ghostkey_factor = 1.0 + (self._ghostkey_bonus if ghostkey_confirmed else 0.0)
        tier_factor = tier.bonus_multiplier
        epoch_factor = max(0.5, 1.0 - epoch.decay)
        amount = (
            self._base_reward
            * tier.base_rate
            * float(behavior_multiplier)
            * ghostkey_factor
            * tier_factor
            * epoch_factor
            * float(weight)
        )
        return round(amount, 6)

    def base_unlock_path(self, wallet: str, loyalty_streak: int) -> str:
        """Return a canonical unlock path identifier."""

        normalized = str(wallet).strip() or "anonymous"
        return f"vaultfire://retroyield/{normalized}/streak/{max(loyalty_streak, 0)}"


# ----------------------------------------------------------------------
# Internal helpers
# ----------------------------------------------------------------------

def _default_tiers() -> Sequence[YieldTier]:
    return (
        YieldTier(name="spark", min_loyalty=0, base_rate=0.6, bonus_multiplier=1.0),
        YieldTier(name="ember", min_loyalty=3, base_rate=1.0, bonus_multiplier=1.15),
        YieldTier(name="flame", min_loyalty=7, base_rate=1.35, bonus_multiplier=1.25),
    )


def _coerce_datetime(value: datetime | None) -> datetime:
    if value is None:
        return datetime.now(timezone.utc)
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
    raise TypeError("expected datetime or None")
