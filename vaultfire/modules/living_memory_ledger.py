"""Living Memory Ledger utilities for Vaultfire engines.

The ledger acts as a lightweight in-memory journal that mirrors the
behaviour described in the Vaultfire protocol notes.  Entries are recorded
with an associated trust score as well as ``impact`` and ``ego`` signals so
engines can reason about proportionality.  The implementation deliberately
keeps the API surface small and deterministic which keeps the surrounding
tests fast and reliable.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable, Mapping, MutableSequence, Sequence


@dataclass(frozen=True)
class MemoryRecord:
    """Immutable representation of a living memory entry."""

    record_id: str
    timestamp: datetime
    payload: Mapping[str, object]
    trust: float
    impact: float
    ego: float

    def to_payload(self) -> Mapping[str, object]:
        """Return a JSON serialisable payload."""

        return {
            "record_id": self.record_id,
            "timestamp": self.timestamp.isoformat(),
            "payload": dict(self.payload),
            "trust": self.trust,
            "impact": self.impact,
            "ego": self.ego,
        }


class LivingMemoryLedger:
    """Minimal ledger that maintains trust aware memory entries."""

    def __init__(
        self,
        *,
        identity_handle: str,
        identity_ens: str,
        base_trust: float = 0.6,
    ) -> None:
        self.identity_handle = identity_handle
        self.identity_ens = identity_ens
        self.base_trust = max(0.0, min(base_trust, 1.0))
        self._records: MutableSequence[MemoryRecord] = []
        self._counter: int = 0
        self.metadata: Mapping[str, object] = {
            "module": "LivingMemoryLedger",
            "identity": {"wallet": identity_handle, "ens": identity_ens},
        }

    # ------------------------------------------------------------------
    # recording helpers
    # ------------------------------------------------------------------
    def _next_id(self) -> str:
        self._counter += 1
        return f"memory-{self._counter:04d}"

    def record(
        self,
        payload: Mapping[str, object],
        *,
        trust: float | None = None,
        impact: float = 0.0,
        ego: float = 0.0,
        timestamp: datetime | None = None,
    ) -> MemoryRecord:
        """Record a new memory entry and return the stored record."""

        trust_value = self._resolve_trust(payload, trust)
        timestamp = timestamp or datetime.now(timezone.utc)
        record = MemoryRecord(
            record_id=self._next_id(),
            timestamp=timestamp,
            payload=dict(payload),
            trust=trust_value,
            impact=float(impact),
            ego=float(ego),
        )
        self._records.append(record)
        return record

    def _resolve_trust(
        self, payload: Mapping[str, object], override: float | None
    ) -> float:
        if override is not None:
            value = float(override)
        else:
            confidence = float(payload.get("confidence", self.base_trust))
            value = 0.5 * self.base_trust + 0.5 * max(0.0, min(confidence, 1.0))
        return max(0.0, min(value, 1.0))

    # ------------------------------------------------------------------
    # inspection utilities
    # ------------------------------------------------------------------
    def records(self) -> Sequence[MemoryRecord]:
        return tuple(self._records)

    def tail(self, limit: int | None = None) -> Sequence[MemoryRecord]:
        if limit is None:
            return self.records()
        if limit <= 0:
            return tuple()
        return tuple(self._records[-limit:])

    def average_trust(self, window: int | None = None) -> float:
        records: Iterable[MemoryRecord]
        if window is None:
            records = self._records
        else:
            records = self.tail(window)
        values = [entry.trust for entry in records]
        if not values:
            return self.base_trust
        return sum(values) / len(values)

    def timeline_bounds(self) -> tuple[datetime, datetime] | None:
        if not self._records:
            return None
        return self._records[0].timestamp, self._records[-1].timestamp

    def find(self, record_id: str) -> MemoryRecord | None:
        for record in self._records:
            if record.record_id == record_id:
                return record
        return None

