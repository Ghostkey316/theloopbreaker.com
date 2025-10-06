"""Soul Loop Fabric engine that bridges ethics tempo and living memory."""

from __future__ import annotations

from typing import Mapping, Sequence

from vaultfire.modules.ethic_resonant_time_engine import EthicResonantTimeEngine
from vaultfire.modules.living_memory_ledger import LivingMemoryLedger, MemoryRecord

from ._metadata import build_metadata


class SoulLoopFabricEngine:
    """Synchronise intent history with the ethic resonant tempo engine."""

    def __init__(
        self,
        *,
        time_engine: EthicResonantTimeEngine | None = None,
        ledger: LivingMemoryLedger | None = None,
        identity_handle: str = "bpow20.cb.id",
        identity_ens: str = "ghostkey316.eth",
    ) -> None:
        self.time_engine = time_engine or EthicResonantTimeEngine(
            "ghostkey-316",
            identity_handle=identity_handle,
            identity_ens=identity_ens,
        )
        self.ledger = ledger or LivingMemoryLedger(
            identity_handle=identity_handle,
            identity_ens=identity_ens,
        )
        self.metadata: Mapping[str, object] = build_metadata(
            "SoulLoopFabricEngine",
            identity={"wallet": identity_handle, "ens": identity_ens},
        )

    # ------------------------------------------------------------------
    # intent management
    # ------------------------------------------------------------------
    def log_intent(
        self,
        intent: str,
        *,
        confidence: float = 0.85,
        tags: Sequence[str] | None = None,
    ) -> MemoryRecord:
        tags = tuple(tags or ())
        action = {
            "type": "support",
            "intent": intent,
            "weight": max(confidence, 0.1) * 10,
            "tags": tags,
        }
        self.time_engine.register_action(action)
        payload = {
            "intent": intent,
            "confidence": confidence,
            "tags": list(tags),
        }
        return self.ledger.record(
            payload,
            trust=confidence,
            impact=max(confidence, 0.0),
            ego=0.0,
        )

    def push_signal(self, value: float, *, intent: str | None = None) -> MemoryRecord:
        label = intent or "signal"
        action_type = "support" if value >= 0 else "selfish"
        self.time_engine.register_action(
            {
                "type": action_type,
                "intent": label,
                "weight": abs(value) * 10,
            }
        )
        trust = 0.6 + max(value, 0.0) * 0.25
        trust = max(0.0, min(trust, 1.0))
        return self.ledger.record(
            {"signal": value, "intent": label},
            trust=trust,
            impact=max(value, 0.0),
            ego=max(-value, 0.0),
        )

    # ------------------------------------------------------------------
    # analytics
    # ------------------------------------------------------------------
    def trace(self, *, window: int = 5) -> Mapping[str, object]:
        pulse_snapshot = self.time_engine.pulse()
        return {
            "tempo": self.time_engine.current_tempo(),
            "moral_score": self.time_engine.mmi.get_score(),
            "trust_window": self.ledger.average_trust(window),
            "history_size": len(self.ledger.records()),
            "latest_pulse": pulse_snapshot.get("pulse"),
            "metadata": self.metadata,
        }

    def history(self) -> Sequence[Mapping[str, object]]:
        return tuple(record.to_payload() for record in self.ledger.records())

    def export(self) -> Mapping[str, object]:
        return {
            "metadata": self.metadata,
            "trace": self.trace(),
            "history": list(self.history()),
        }

