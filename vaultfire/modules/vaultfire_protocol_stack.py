"""Integrated Vaultfire protocol stack for the Ghostkey CLI.

The module exposes lightweight Python implementations of the systems
described in the Vaultfire activation brief.  Each class focuses on providing
deterministic, testable behaviour so the surrounding tooling (CLI commands
and pytest suites) can exercise the protocol without depending on external
infrastructure.  The real production counterparts would speak to distributed
ledgers and quantum mirrors; here we provide auditable facsimiles.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from importlib import import_module
from typing import Callable, Iterable, List, Mapping, MutableMapping, Sequence

from vaultfire.modules.ethic_resonant_time_engine import EthicResonantTimeEngine
from vaultfire.protocol.signal_echo import SignalEchoEngine
from vaultfire.quantum.hashmirror import QuantumHashMirror

_yield_module = import_module("vaultfire.yield")
PulseSync = getattr(_yield_module, "PulseSync")
TemporalGiftMatrixEngine = getattr(_yield_module, "TemporalGiftMatrixEngine")

IDENTITY_HANDLE = "bpow20.cb.id"
IDENTITY_ENS = "ghostkey316.eth"


def _now_ts() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class LedgerAction:
    """Internal representation of a ledger action."""

    payload: Mapping[str, object]
    approved: bool
    belief_delta: float
    recorded_at: str = field(default_factory=_now_ts)


class ConsciousStateEngine:
    """Record ethics-checked ledger actions and compute belief health."""

    POSITIVE_ETHICS = {"aligned", "support", "sacrifice", "uplift"}
    NEGATIVE_ETHICS = {"betrayal", "selfish", "drain"}

    def __init__(
        self,
        *,
        identity_handle: str = IDENTITY_HANDLE,
        identity_ens: str = IDENTITY_ENS,
    ) -> None:
        self.identity_handle = identity_handle
        self.identity_ens = identity_ens
        self._ledger: List[LedgerAction] = []
        self.metadata: Mapping[str, object] = {
            "module": "ConsciousStateEngine",
            "identity": {
                "wallet": identity_handle,
                "ens": identity_ens,
            },
        }

    # ------------------------------------------------------------------
    # action tracking
    # ------------------------------------------------------------------
    def record_action(self, action: Mapping[str, object]) -> LedgerAction:
        """Store an ethics filtered ledger action."""

        ethic = str(action.get("ethic", "aligned")).lower()
        weight = float(action.get("weight", 1.0))
        belief_delta = self._resolve_belief_delta(ethic, weight)
        if "approved" in action:
            approved = bool(action.get("approved"))
        else:
            approved = ethic in self.POSITIVE_ETHICS
        record = LedgerAction(payload=dict(action), approved=approved, belief_delta=belief_delta)
        record.payload.setdefault(
            "identity",
            {"wallet": self.identity_handle, "ens": self.identity_ens},
        )
        record.payload.setdefault("ethic", ethic)
        self._ledger.append(record)
        return record

    def _resolve_belief_delta(self, ethic: str, weight: float) -> float:
        if ethic in self.POSITIVE_ETHICS:
            return min(1.0, 0.5 + abs(weight) * 0.1)
        if ethic in self.NEGATIVE_ETHICS:
            return max(-1.0, -0.5 - abs(weight) * 0.1)
        return 0.0

    # ------------------------------------------------------------------
    # analytics
    # ------------------------------------------------------------------
    def belief_health(self) -> float:
        """Return the average belief delta constrained to ``[0, 1]``."""

        if not self._ledger:
            return 1.0
        raw = sum(entry.belief_delta for entry in self._ledger) / len(self._ledger)
        return max(0.0, min((raw + 1.0) / 2.0, 1.0))

    def sync_diagnostics(self) -> Mapping[str, object]:
        """Expose Ghostkey CLI friendly diagnostics."""

        last = self._ledger[-1] if self._ledger else None
        return {
            "identity": self.metadata["identity"],
            "actions": len(self._ledger),
            "belief_health": self.belief_health(),
            "last_action": dict(last.payload) if last else None,
        }

    def ledger(self) -> Sequence[LedgerAction]:
        """Return a snapshot of the ledger."""

        return tuple(self._ledger)


class PredictiveYieldFabric:
    """Weighted forecasting and auto-optimisation helper."""

    def __init__(
        self,
        *,
        identity_handle: str = IDENTITY_HANDLE,
        identity_ens: str = IDENTITY_ENS,
    ) -> None:
        self.identity_handle = identity_handle
        self.identity_ens = identity_ens
        self._exports: MutableMapping[str, float] = {}
        self._hooks: MutableMapping[str, Callable[[Mapping[str, float]], None]] = {}
        self._latest_forecast: Mapping[str, object] | None = None
        self.metadata: Mapping[str, object] = {
            "module": "PredictiveYieldFabric",
            "identity": {
                "wallet": identity_handle,
                "ens": identity_ens,
            },
        }

    def register_export(self, name: str, weight: float) -> None:
        weight = max(weight, 0.0)
        self._exports[name] = weight

    def register_hook(self, name: str, callback: Callable[[Mapping[str, float]], None]) -> None:
        self._hooks[name] = callback

    def forecast(self, signal_purity: float, base_yield: float, *, horizon: int = 3) -> Mapping[str, object]:
        """Compute a weighted yield forecast and notify registered hooks."""

        if not self._exports:
            self.register_export("core", 1.0)
        normalized_total = sum(self._exports.values()) or 1.0
        composite = base_yield * (0.5 + max(signal_purity, 0.0) * 0.5)
        distribution = {
            name: composite * (weight / normalized_total)
            for name, weight in self._exports.items()
        }
        for callback in self._hooks.values():
            callback(distribution)
        self._latest_forecast = {
            "identity": self.metadata["identity"],
            "horizon": horizon,
            "composite_yield": composite,
            "distribution": distribution,
            "timestamp": _now_ts(),
        }
        return self._latest_forecast

    def auto_optimize(self) -> Mapping[str, object]:
        """Return normalised export weights."""

        total = sum(self._exports.values()) or 1.0
        normalised = {name: (weight / total) for name, weight in self._exports.items()}
        return {
            "identity": self.metadata["identity"],
            "normalized_weights": normalised,
        }

    @property
    def latest_forecast(self) -> Mapping[str, object] | None:
        return self._latest_forecast


class MissionSoulLoop:
    """Track intent evolution and profile state for Ghostkey identity."""

    def __init__(
        self,
        *,
        identity_handle: str = IDENTITY_HANDLE,
        identity_ens: str = IDENTITY_ENS,
    ) -> None:
        self.identity_handle = identity_handle
        self.identity_ens = identity_ens
        self._history: List[Mapping[str, object]] = []
        self._profile: MutableMapping[str, object] = {
            "ens": identity_ens,
            "wallet": identity_handle,
            "soul_checkpoint": 0,
        }

    def log_intent(
        self,
        intent: str,
        *,
        confidence: float,
        tags: Sequence[str] = (),
    ) -> Mapping[str, object]:
        record = {
            "intent": intent,
            "confidence": float(confidence),
            "tags": tuple(tags),
            "recorded_at": _now_ts(),
        }
        self._history.append(record)
        self._profile["soul_checkpoint"] = len(self._history)
        return record

    def update_profile(self, **fields: object) -> Mapping[str, object]:
        self._profile.update(fields)
        return dict(self._profile)

    def history(self) -> Sequence[Mapping[str, object]]:
        return tuple(self._history)

    def checkpoint(self) -> Mapping[str, object]:
        return {
            "profile": dict(self._profile),
            "history": list(self._history[-3:]),
        }


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
        self.metadata: Mapping[str, object] = {
            "module": "GiftMatrix_v1",
            "first_of_its_kind": True,
            "identity": {
                "wallet": identity_handle,
                "ens": identity_ens,
            },
        }
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

    def unlock_next(self, label: str | None = None) -> Mapping[str, object]:
        return self.gift_matrix.unlock_next_layer(label)

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

