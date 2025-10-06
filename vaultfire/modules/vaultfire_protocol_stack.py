"""Bundled Vaultfire protocol stack components for Ghostkey activation."""

from __future__ import annotations

from datetime import datetime, timezone
from importlib import import_module
from typing import Iterable, List, Mapping, Sequence

from vaultfire.modules._metadata import build_metadata
from vaultfire.modules.conscious_state_engine import ConsciousStateEngine
from vaultfire.modules.ethic_resonant_time_engine import EthicResonantTimeEngine
from vaultfire.modules.mission_soul_loop import MissionSoulLoop
from vaultfire.modules.predictive_yield_fabric import PredictiveYieldFabric
from vaultfire.protocol.signal_echo import SignalEchoEngine
from vaultfire.quantum.hashmirror import QuantumHashMirror

_yield_module = import_module("vaultfire.yield")
PulseSync = getattr(_yield_module, "PulseSync")
TemporalGiftMatrixEngine = getattr(_yield_module, "TemporalGiftMatrixEngine")

IDENTITY_HANDLE = "bpow20.cb.id"
IDENTITY_ENS = "ghostkey316.eth"


def _now_ts() -> str:
    return datetime.now(timezone.utc).isoformat()


class _EphemeralTimeFlare:
    """Minimal TimeFlare compatible helper used for tests and CLI."""

    def __init__(self) -> None:
        self._ledger: List[Mapping[str, object]] = []

    def register(self, entry: Mapping[str, object]) -> None:
        self._ledger.append(dict(entry))

    def load(self) -> List[Mapping[str, object]]:
        return [dict(entry) for entry in self._ledger]


class GiftMatrixV1:
    """Belief signal reward distribution orchestrator."""

    def __init__(
        self,
        *,
        identity_handle: str = IDENTITY_HANDLE,
        identity_ens: str = IDENTITY_ENS,
        timeflare: _EphemeralTimeFlare | None = None,
        signal_engine: SignalEchoEngine | None = None,
        pulse_sync: PulseSync | None = None,
        hash_mirror: QuantumHashMirror | None = None,
    ) -> None:
        self.identity_handle = identity_handle
        self.identity_ens = identity_ens
        self._timeflare = timeflare or _EphemeralTimeFlare()
        self.signal_engine = signal_engine or SignalEchoEngine()
        self.pulse_sync = pulse_sync or PulseSync()
        self.hash_mirror = hash_mirror or QuantumHashMirror(
            seed=f"gift-matrix::{identity_ens}"
        )
        self.engine = TemporalGiftMatrixEngine(
            timeflare=self._timeflare,
            signal_engine=self.signal_engine,
            pulse_sync=self.pulse_sync,
            hash_mirror=self.hash_mirror,
            base_reward=180.0,
        )
        self.metadata: Mapping[str, object] = build_metadata(
            "GiftMatrix_v1",
            identity={"wallet": identity_handle, "ens": identity_ens},
        )
        self._fork_log: List[Mapping[str, object]] = []
        self._unlocked_layers: List[Mapping[str, object]] = []
        self._last_signal_purity: float = 0.0
        self._last_record: Mapping[str, object] | None = None

    def record_signal(
        self,
        interaction_id: str,
        *,
        belief_purity: float,
        emotion: str = "focus",
        ethic: str = "aligned",
        tags: Sequence[str] = (),
    ) -> None:
        self._last_signal_purity = float(belief_purity)
        self.signal_engine.record_frame(
            interaction_id,
            emotion=emotion,
            ethic=ethic,
            intensity=belief_purity,
            tags=tags,
        )

    def register_fork(
        self,
        interaction_id: str,
        *,
        branch: str,
        priority: str,
        ethic_score: float,
        alignment_bias: float,
    ) -> Mapping[str, object]:
        entry = {
            "interaction_id": interaction_id,
            "branch": branch,
            "priority": priority,
            "ethic_score": float(ethic_score),
            "alignment_bias": float(alignment_bias),
            "created_at": _now_ts(),
        }
        self._fork_log.append(entry)
        self._timeflare.register(entry)
        return entry

    def claim(self, interaction_id: str, recipients: Iterable[str | Mapping[str, object]]):
        record = self.engine.generate_matrix(interaction_id, recipients)
        self._last_record = {
            "record_id": record.record_id,
            "metadata": dict(record.metadata),
            "allocations": [allocation.__dict__ for allocation in record.allocations],
        }
        return record

    def unlock_next_layer(self, label: str | None = None) -> Mapping[str, object]:
        layer_index = len(self._unlocked_layers) + 1
        entry = {
            "layer": layer_index,
            "label": label or f"Layer-{layer_index}",
            "unlocked_at": _now_ts(),
        }
        self._unlocked_layers.append(entry)
        return entry

    def pulse_watch(self) -> Mapping[str, object]:
        return {
            "identity": self.metadata["identity"],
            "active_layers": len(self._unlocked_layers),
            "forks_tracked": len(self._fork_log),
            "last_signal_purity": self._last_signal_purity,
            "last_record": self._last_record,
            "metadata": self.metadata,
        }


class VaultfireProtocolStack:
    """Convenience wrapper bundling the protocol systems."""

    def __init__(
        self,
        *,
        identity_handle: str = IDENTITY_HANDLE,
        identity_ens: str = IDENTITY_ENS,
        actions: Sequence[Mapping[str, object]] = (),
    ) -> None:
        self.identity_handle = identity_handle
        self.identity_ens = identity_ens
        self.conscious = ConsciousStateEngine(
            identity_handle=identity_handle,
            identity_ens=identity_ens,
        )
        self.predictive = PredictiveYieldFabric(
            identity_handle=identity_handle,
            identity_ens=identity_ens,
        )
        self.soul = MissionSoulLoop(
            identity_handle=identity_handle,
            identity_ens=identity_ens,
        )
        self.time_engine = EthicResonantTimeEngine(
            "ghostkey-316",
            identity_handle=identity_handle,
            identity_ens=identity_ens,
        )
        self.gift_matrix = GiftMatrixV1(
            identity_handle=identity_handle,
            identity_ens=identity_ens,
        )
        for action in actions:
            self.conscious.record_action(action)
            self.time_engine.register_action(action)
        self.predictive.register_export("core", 1.0)
        self.predictive.forecast(self.conscious.belief_health(), 120.0)

    def pulsewatch(self) -> Mapping[str, object]:
        summary = self.gift_matrix.pulse_watch()
        summary.update(
            {
                "belief_health": self.conscious.belief_health(),
                "tempo": self.time_engine.current_tempo(),
                "yield_forecast": self.predictive.latest_forecast,
            }
        )
        return summary


# ---------------------------------------------------------------------------
# Future module scaffolding
# ---------------------------------------------------------------------------


class AdaptiveRelicStore:
    """Placeholder scaffold for the Adaptive Relic Store module."""

    def __init__(self) -> None:
        self.backlog: List[str] = []

    def blueprint(self, relic_name: str) -> Mapping[str, object]:
        self.backlog.append(relic_name)
        return {
            "relic": relic_name,
            "status": "planned",
            "created_at": _now_ts(),
        }


class GhostMemoryArchive:
    """Placeholder scaffold for time-locked memory unlocks."""

    def __init__(self) -> None:
        self._anchors: List[Mapping[str, object]] = []

    def plan_anchor(self, label: str, unlock_at: str) -> Mapping[str, object]:
        entry = {"label": label, "unlock_at": unlock_at}
        self._anchors.append(entry)
        return entry


class SignalForge:
    """Placeholder scaffold for the belief-to-energy converter."""

    def __init__(self) -> None:
        self._designs: List[Mapping[str, object]] = []

    def draft_conversion(self, signal: str, efficiency: float) -> Mapping[str, object]:
        plan = {
            "signal": signal,
            "efficiency": efficiency,
            "created_at": _now_ts(),
        }
        self._designs.append(plan)
        return plan


class VaultfireDNASyncer:
    """Placeholder scaffold for legacy moral imprint technology."""

    def __init__(self) -> None:
        self._imprints: List[Mapping[str, object]] = []

    def schedule_imprint(self, reference: str, integrity: float) -> Mapping[str, object]:
        imprint = {
            "reference": reference,
            "integrity": integrity,
            "scheduled_at": _now_ts(),
        }
        self._imprints.append(imprint)
        return imprint


__all__ = [
    "ConsciousStateEngine",
    "PredictiveYieldFabric",
    "MissionSoulLoop",
    "GiftMatrixV1",
    "VaultfireProtocolStack",
    "AdaptiveRelicStore",
    "GhostMemoryArchive",
    "SignalForge",
    "VaultfireDNASyncer",
]

