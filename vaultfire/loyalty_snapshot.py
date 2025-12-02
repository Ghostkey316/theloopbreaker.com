"""LoyaltyMesh snapshot layer for weekly validator state."""
from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Iterable, Mapping, MutableMapping, Sequence

from .loyalty_engine import LoyaltyEngine


@dataclass(frozen=True)
class WeeklyLoyaltySnapshot:
    """Weekly loyalty snapshot for a validator."""

    validator_id: str
    timestamp: datetime
    net_multiplier: float
    pop_tier: int
    belief_sync_streak: int
    active_streak_days: int
    missed_windows: int
    yield_class: str

    def asdict(self) -> Mapping[str, object]:
        payload = asdict(self)
        payload["timestamp"] = self.timestamp.isoformat()
        return payload


class LoyaltySnapshotter:
    """Capture and persist LoyaltyMesh weekly summaries."""

    def __init__(self, engine: LoyaltyEngine, *, snapshot_path: str | Path = "loyalty_snapshots.json") -> None:
        self.engine = engine
        self.snapshot_path = Path(snapshot_path)

    def capture(
        self,
        validator_id: str,
        *,
        pop_tier: int,
        belief_sync_streak: int,
        recall_history: Sequence[float | bool] | None = None,
        missed_windows: int = 0,
    ) -> WeeklyLoyaltySnapshot:
        multiplier = self.engine.calculate_multiplier(
            validator_id,
            pop_tier=pop_tier,
            belief_sync_streak=belief_sync_streak,
            recall_history=recall_history,
        )
        snapshot = WeeklyLoyaltySnapshot(
            validator_id=validator_id,
            timestamp=multiplier.timestamp,
            net_multiplier=multiplier.net_multiplier,
            pop_tier=pop_tier,
            belief_sync_streak=belief_sync_streak,
            active_streak_days=belief_sync_streak,
            missed_windows=max(0, missed_windows),
            yield_class=self.engine.classify_yield_class(multiplier.net_multiplier),
        )
        self._persist_snapshot(snapshot)
        return snapshot

    def _persist_snapshot(self, snapshot: WeeklyLoyaltySnapshot) -> None:
        payload = snapshot.asdict()
        current = self._load_snapshots()
        current.append(payload)
        self.snapshot_path.write_text(self._format_json(current), encoding="utf-8")

    def _load_snapshots(self) -> list[MutableMapping[str, object]]:
        if not self.snapshot_path.exists():
            return []
        try:
            import json

            data = json.loads(self.snapshot_path.read_text(encoding="utf-8"))
            return data if isinstance(data, list) else []
        except Exception:
            return []

    @staticmethod
    def _format_json(payload: Sequence[Mapping[str, object]]) -> str:
        import json

        return json.dumps(payload, indent=2, sort_keys=True)

    def project_yield_classes(self, validators: Iterable[Mapping[str, object]]) -> Mapping[str, int]:
        projection: MutableMapping[str, int] = {}
        rollups = self.engine.rollup_validators(validators)
        for rollup in rollups:
            yield_class = self.engine.classify_yield_class(rollup.net_multiplier)
            projection[yield_class] = projection.get(yield_class, 0) + 1
        return projection

    def history(self) -> list[Mapping[str, object]]:
        return list(self._load_snapshots())
