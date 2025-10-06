"""Quantum Echo Mirror built on top of the Living Memory Ledger."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Mapping, Sequence

from vaultfire.modules.ethic_resonant_time_engine import EthicResonantTimeEngine
from vaultfire.modules.living_memory_ledger import LivingMemoryLedger, MemoryRecord


class QuantumEchoMirror:
    """Project timelines while respecting trust floors and tempo bounds."""

    _TEMPO_BOUNDS = {
        "slow": 60 * 60,  # 1 hour
        "normal": 60 * 60 * 4,  # 4 hours
        "fast": 60 * 60 * 8,  # 8 hours
        "ultrafast": 60 * 60 * 12,  # 12 hours
    }

    def __init__(
        self,
        *,
        time_engine: EthicResonantTimeEngine,
        ledger: LivingMemoryLedger,
    ) -> None:
        self.time_engine = time_engine
        self.ledger = ledger
        self.metadata: Mapping[str, object] = {
            "module": "QuantumEchoMirror",
            "first_of_its_kind": True,
            "tags": ("FOTK",),
        }

    # ------------------------------------------------------------------
    # helpers
    # ------------------------------------------------------------------
    def _bound_seconds(self) -> int:
        tempo = self.time_engine.current_tempo()
        return int(self._TEMPO_BOUNDS.get(tempo, 60 * 60))

    def _eligible_records(
        self, *, trust_floor: float, limit: int | None = None
    ) -> Sequence[MemoryRecord]:
        now = datetime.now(timezone.utc)
        bound = self._bound_seconds()
        records = []
        for record in reversed(self.ledger.records()):
            if record.trust < trust_floor:
                continue
            delta = now - record.timestamp
            if delta.total_seconds() > bound:
                continue
            records.append(record)
            if limit is not None and len(records) >= limit:
                break
        return tuple(reversed(records))

    # ------------------------------------------------------------------
    # public interface
    # ------------------------------------------------------------------
    def project_future(
        self,
        *,
        steps: int = 3,
        trust_floor: float = 0.6,
    ) -> Mapping[str, object]:
        candidates = self._eligible_records(trust_floor=trust_floor, limit=steps)
        pulse = self.time_engine.pulse()
        return {
            "tempo": self.time_engine.current_tempo(),
            "bound_seconds": self._bound_seconds(),
            "forecast": [
                {
                    "record_id": record.record_id,
                    "timestamp": record.timestamp.isoformat(),
                    "intent": record.payload.get("intent") or record.payload.get("signal"),
                    "trust": record.trust,
                    "projected_pulse": pulse.get("pulse"),
                }
                for record in candidates
            ],
            "metadata": self.metadata,
        }

    def traceback(
        self,
        *,
        trust_floor: float = 0.5,
        window: int | None = None,
    ) -> Mapping[str, object]:
        limit = window if window and window > 0 else None
        candidates = self._eligible_records(trust_floor=trust_floor, limit=limit)
        return {
            "tempo": self.time_engine.current_tempo(),
            "bound_seconds": self._bound_seconds(),
            "timeline": [record.to_payload() for record in candidates],
            "metadata": self.metadata,
        }

