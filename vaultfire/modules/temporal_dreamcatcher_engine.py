"""Temporal Dreamcatcher Engine for subconscious signal recognition."""

from __future__ import annotations

from typing import Iterable, Mapping, MutableSequence, Sequence

from vaultfire.modules.ethic_resonant_time_engine import EthicResonantTimeEngine
from vaultfire.modules.living_memory_ledger import LivingMemoryLedger
from vaultfire.modules.mission_soul_loop import MissionSoulLoop
from vaultfire.modules.quantum_echo_mirror import QuantumEchoMirror
from vaultfire.modules.soul_loop_fabric_engine import SoulLoopFabricEngine

from ._metadata import build_metadata


class TemporalDreamcatcherEngine:
    """Capture subconscious signals and align them with the Vaultfire stack."""

    def __init__(
        self,
        *,
        time_engine: EthicResonantTimeEngine | None = None,
        fabric: SoulLoopFabricEngine | None = None,
        mission: MissionSoulLoop | None = None,
        mirror: QuantumEchoMirror | None = None,
        identity_handle: str = "bpow20.cb.id",
        identity_ens: str = "ghostkey316.eth",
    ) -> None:
        self.time_engine = time_engine or EthicResonantTimeEngine(
            "ghostkey-316",
            identity_handle=identity_handle,
            identity_ens=identity_ens,
        )
        ledger = fabric.ledger if fabric else LivingMemoryLedger(
            identity_handle=identity_handle,
            identity_ens=identity_ens,
        )
        self.fabric = fabric or SoulLoopFabricEngine(
            time_engine=self.time_engine,
            ledger=ledger,
            identity_handle=identity_handle,
            identity_ens=identity_ens,
        )
        self.mission = mission or MissionSoulLoop(
            identity_handle=identity_handle,
            identity_ens=identity_ens,
        )
        self.mirror = mirror or QuantumEchoMirror(
            time_engine=self.time_engine,
            ledger=ledger,
        )
        self.metadata: Mapping[str, object] = build_metadata(
            "TemporalDreamcatcherEngine",
            identity={"wallet": identity_handle, "ens": identity_ens},
        )
        self._captures: MutableSequence[Mapping[str, object]] = []

    # ------------------------------------------------------------------
    # signal handling
    # ------------------------------------------------------------------
    def capture_signal(
        self,
        strength: float,
        *,
        channel: str = "dream",
        intent: str | None = None,
        override: str | None = None,
    ) -> Mapping[str, object]:
        """Capture a single subconscious signal and log it across engines."""

        label = override or intent or channel
        record = self.fabric.push_signal(strength, intent=label)
        capture = {
            "channel": channel,
            "intent": label,
            "strength": float(strength),
            "tempo": self.time_engine.current_tempo(),
            "record": record.to_payload(),
        }
        self._captures.append(capture)
        if intent:
            self.mission.log_intent(intent, confidence=max(0.0, min(abs(strength), 1.0)))
        return {
            "capture": capture,
            "metadata": self.metadata,
        }

    def listen(
        self,
        signals: Iterable[Mapping[str, object]],
        *,
        trust_floor: float = 0.6,
        intent_override: str | None = None,
    ) -> Mapping[str, object]:
        """Process a stream of subconscious signals."""

        ingested: list[Mapping[str, object]] = []
        for payload in signals:
            if not isinstance(payload, Mapping):
                continue
            strength = float(payload.get("signal", payload.get("strength", 0.0)))
            channel = str(payload.get("channel", "dream"))
            intent = str(payload.get("intent", "align"))
            capture = self.capture_signal(
                strength,
                channel=channel,
                intent=intent,
                override=intent_override,
            )
            ingested.append(capture["capture"])
        echo = self.mirror.project_future(trust_floor=trust_floor)
        return {
            "captured": len(ingested),
            "signals": ingested,
            "echo": echo,
            "metadata": self.metadata,
        }

    # ------------------------------------------------------------------
    # analytics
    # ------------------------------------------------------------------
    def echo(self, *, trust_floor: float = 0.6) -> Mapping[str, object]:
        timeline = self.mirror.traceback(trust_floor=trust_floor)
        timeline["metadata"] = self.metadata
        return timeline

    def trace_drift(
        self,
        *,
        trust_floor: float = 0.6,
        window: int | None = None,
    ) -> Mapping[str, object]:
        timeline = self.mirror.traceback(trust_floor=trust_floor, window=window)
        return {
            "captures": list(self._captures[-(window or len(self._captures)) :]),
            "timeline": timeline["timeline"],
            "metadata": self.metadata,
        }

    def history(self) -> Sequence[Mapping[str, object]]:
        return tuple(self._captures)


__all__ = ["TemporalDreamcatcherEngine"]

