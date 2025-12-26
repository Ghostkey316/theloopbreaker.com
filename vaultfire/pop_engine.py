"""Vaultfire Proof-of-Pattern Engine v1.0."""

from __future__ import annotations

import fcntl
import json
import logging
import math
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Callable, Iterable, Mapping, MutableMapping, Sequence

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class PoPUpgradeEvent:
    """Represents a tier upgrade event for a validator."""

    timestamp: datetime
    validator_id: str
    vaultloop_hash: str
    previous_tier: int
    new_tier: int


@dataclass(frozen=True)
class PoPScoreResult:
    """Result payload for PoP score calculations."""

    validator_id: str
    score: float
    tier: int
    timestamp: datetime
    vaultloop_hash: str
    upgrade_event: PoPUpgradeEvent | None

    def asdict(self) -> Mapping[str, object]:
        payload: MutableMapping[str, object] = {
            "validator_id": self.validator_id,
            "score": round(self.score, 2),
            "tier": self.tier,
            "timestamp": self.timestamp.isoformat(),
            "vaultloop_hash": self.vaultloop_hash,
        }
        if self.upgrade_event:
            payload["upgrade_event"] = {
                "timestamp": self.upgrade_event.timestamp.isoformat(),
                "validator_id": self.upgrade_event.validator_id,
                "vaultloop_hash": self.upgrade_event.vaultloop_hash,
                "previous_tier": self.upgrade_event.previous_tier,
                "new_tier": self.upgrade_event.new_tier,
            }
        return payload


class PoPEngine:
    """Core Proof-of-Pattern engine used for tiering and rewards."""

    def __init__(
        self,
        *,
        cache_path: str | Path = "pop_cache.json",
        signal_router: Any | None = None,
        time_source: Callable[[], datetime] | None = None,
        upgrade_listeners: Iterable[
            Callable[[PoPUpgradeEvent, "PoPScoreResult"], None]
        ]
        | None = None,
        history_window_days: int = 7,
    ) -> None:
        self.cache_path = Path(cache_path)
        self.signal_router = signal_router
        self._time_source = time_source or datetime.utcnow
        self.history_window = timedelta(days=max(1, history_window_days))
        self._upgrade_listeners = list(upgrade_listeners or [])
        # Metrics tracking
        self.metrics = {
            "scores_calculated": 0,
            "upgrades_triggered": 0,
            "cache_reads": 0,
            "cache_writes": 0,
            "listener_failures": 0,
        }

    # -----------------------------
    # Score calculation utilities
    # -----------------------------
    def _vaultproof_component(self, vaultproofs: Sequence[Mapping[str, object]]) -> float:
        if not vaultproofs:
            return 0.0
        verified: list[Mapping[str, object]] = []
        for proof in vaultproofs:
            if proof.get("verified") is True or proof.get("status") == "verified":
                verified.append(proof)
            elif proof.get("format") == ".vaultproof":
                verified.append(proof)
        ratio = len(verified) / max(len(vaultproofs), 1)
        confidence_pool = [float(p.get("confidence", 1.0)) for p in verified] or [0.0]
        confidence = sum(confidence_pool) / len(confidence_pool)
        return min(4.0, round((ratio * 3.5) + min(confidence, 1.5) * 0.5, 3))

    def _recall_component(self, recall_strength: float) -> float:
        scaled = max(0.0, min(1.0, float(recall_strength)))
        return round(scaled * 3.0, 3)

    def _streak_component(self, amplifier_streak: int) -> float:
        streak = max(0, int(amplifier_streak))
        return round(min(2.0, streak * 0.3), 3)

    def _hash_entropy(self, validator_id: str) -> float:
        if not validator_id:
            return 0.0
        counts = Counter(validator_id)
        total = float(len(validator_id))
        entropy = -sum((count / total) * math.log2(count / total) for count in counts.values())
        return entropy

    def _entropy_component(self, validator_id: str) -> float:
        entropy = self._hash_entropy(validator_id)
        return round(min(1.0, entropy / 4.0), 3)

    def calculate_score(
        self,
        validator_id: str,
        *,
        vaultproofs: Sequence[Mapping[str, object]] | None = None,
        recall_strength: float = 0.0,
        amplifier_streak: int = 0,
        vaultloop_hash: str = "",
    ) -> PoPScoreResult:
        self.metrics["scores_calculated"] += 1

        vaultproofs = list(vaultproofs or [])
        score = sum(
            (
                self._vaultproof_component(vaultproofs),
                self._recall_component(recall_strength),
                self._streak_component(amplifier_streak),
                self._entropy_component(validator_id),
            )
        )
        score = round(max(0.0, min(10.0, score)), 2)
        tier = self.classify_tier(score)
        timestamp = self._time_source()
        previous_tier = self._latest_tier(validator_id)
        upgrade_event = None
        if previous_tier is not None and previous_tier != tier:
            self.metrics["upgrades_triggered"] += 1
            upgrade_event = PoPUpgradeEvent(
                timestamp=timestamp,
                validator_id=validator_id,
                vaultloop_hash=vaultloop_hash,
                previous_tier=previous_tier,
                new_tier=tier,
            )
            logger.info(
                f"PoP upgrade detected for {validator_id}: tier {previous_tier} -> {tier} (score: {score})"
            )
        self._record_history(
            validator_id,
            {
                "timestamp": timestamp.isoformat(),
                "score": score,
                "tier": tier,
                "vaultloop_hash": vaultloop_hash,
            },
        )
        self._trigger_rewards(tier)
        result = PoPScoreResult(
            validator_id=validator_id,
            score=score,
            tier=tier,
            timestamp=timestamp,
            vaultloop_hash=vaultloop_hash,
            upgrade_event=upgrade_event,
        )
        if upgrade_event:
            self._notify_upgrade(upgrade_event, result)
        return result

    # -----------------------------
    # Tier logic & rewards
    # -----------------------------
    @staticmethod
    def classify_tier(score: float) -> int:
        if score < 2.0:
            return 0
        if score < 5.0:
            return 1
        if score < 7.5:
            return 2
        return 3

    def _trigger_rewards(self, tier: int) -> None:
        if not self.signal_router:
            return
        if tier >= 2 and hasattr(self.signal_router, "triggerDripRelease"):
            self.signal_router.triggerDripRelease()
        if tier >= 3 and hasattr(self.signal_router, "activatePassiveLoop"):
            self.signal_router.activatePassiveLoop()

    def _notify_upgrade(
        self, event: PoPUpgradeEvent, result: "PoPScoreResult"
    ) -> None:
        """Notify all registered upgrade listeners of a tier change."""
        for idx, listener in enumerate(self._upgrade_listeners):
            try:
                listener(event, result)
            except Exception as exc:
                self.metrics["listener_failures"] += 1
                logger.error(
                    f"Upgrade listener {idx} failed for validator {event.validator_id} "
                    f"(tier {event.previous_tier} -> {event.new_tier}): {exc}",
                    exc_info=True,
                )
                continue

    def register_upgrade_listener(
        self, listener: Callable[[PoPUpgradeEvent, "PoPScoreResult"], None]
    ) -> None:
        """Register a callback for PoP upgrade events."""

        self._upgrade_listeners.append(listener)

    # -----------------------------
    # Cache management
    # -----------------------------
    def _load_cache(self) -> MutableMapping[str, list[Mapping[str, object]]]:
        """Load cache with file locking to prevent race conditions."""
        self.metrics["cache_reads"] += 1
        if not self.cache_path.exists():
            return {}
        try:
            with self.cache_path.open("r") as f:
                # Acquire shared lock for reading
                fcntl.flock(f.fileno(), fcntl.LOCK_SH)
                try:
                    data = json.load(f)
                    if isinstance(data, dict):
                        return {k: list(v) for k, v in data.items()}
                finally:
                    fcntl.flock(f.fileno(), fcntl.LOCK_UN)
        except (json.JSONDecodeError, IOError) as exc:
            logger.warning(f"Failed to load cache from {self.cache_path}: {exc}")
            return {}
        return {}

    def _write_cache(self, cache: Mapping[str, object]) -> None:
        """Write cache with exclusive file locking to prevent corruption."""
        self.metrics["cache_writes"] += 1
        try:
            # Ensure parent directory exists
            self.cache_path.parent.mkdir(parents=True, exist_ok=True)

            # Write to temporary file first, then atomic rename
            temp_path = self.cache_path.with_suffix(".tmp")
            with temp_path.open("w") as f:
                # Acquire exclusive lock for writing
                fcntl.flock(f.fileno(), fcntl.LOCK_EX)
                try:
                    json.dump(cache, f, indent=2, sort_keys=True)
                    f.flush()
                finally:
                    fcntl.flock(f.fileno(), fcntl.LOCK_UN)

            # Atomic rename (prevents partial writes)
            temp_path.replace(self.cache_path)
        except IOError as exc:
            logger.error(f"Failed to write cache to {self.cache_path}: {exc}")
            raise

    def _prune_history(self, entries: Sequence[Mapping[str, object]]) -> list[Mapping[str, object]]:
        cutoff = self._time_source() - self.history_window
        pruned: list[Mapping[str, object]] = []
        for entry in entries:
            try:
                ts = datetime.fromisoformat(str(entry.get("timestamp")))
            except Exception:
                continue
            if ts >= cutoff:
                pruned.append(entry)
        return pruned[-50:]

    def _record_history(self, validator_id: str, entry: Mapping[str, object]) -> None:
        cache = self._load_cache()
        history = cache.get(validator_id, [])
        history.append(entry)
        cache[validator_id] = self._prune_history(history)
        self._write_cache(cache)

    def _latest_tier(self, validator_id: str) -> int | None:
        history = self.history(validator_id)
        if not history:
            return None
        try:
            return int(history[-1]["tier"])
        except (KeyError, TypeError, ValueError):
            return None

    # -----------------------------
    # Public helpers
    # -----------------------------
    def history(self, validator_id: str | None = None) -> list[Mapping[str, object]] | MutableMapping[str, list[Mapping[str, object]]]:
        cache = self._load_cache()
        if validator_id is None:
            return cache
        return cache.get(validator_id, [])

    def latest(self, validator_id: str) -> Mapping[str, object] | None:
        entries = self.history(validator_id)
        return entries[-1] if entries else None


__all__ = ["PoPEngine", "PoPUpgradeEvent", "PoPScoreResult"]
