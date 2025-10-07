"""Vaultfire enhancement modules for the Ghostkey protocol stack."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from typing import Iterable, Mapping, MutableMapping, MutableSequence, Sequence

from vaultfire.quantum.hashmirror import QuantumHashMirror

from ._metadata import build_metadata

IDENTITY_HANDLE = "bpow20.cb.id"
IDENTITY_ENS = "ghostkey316.eth"


def _now_ts() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalise_alignment(value: float) -> float:
    return max(0.0, min(value, 1.0))


@dataclass
class _CompressionThreshold:
    label: str
    triggers: tuple[str, ...]
    cadence: str
    required_alignment: float
    rewards: Mapping[str, object]

    def to_payload(self) -> Mapping[str, object]:
        return {
            "label": self.label,
            "triggers": list(self.triggers),
            "cadence": self.cadence,
            "required_alignment": self.required_alignment,
            "rewards": dict(self.rewards),
        }


class TemporalBehavioralCompressionEngine:
    """Compress time-gated rewards into behavioral unlock thresholds."""

    def __init__(
        self,
        *,
        identity_handle: str = IDENTITY_HANDLE,
        identity_ens: str = IDENTITY_ENS,
    ) -> None:
        self.identity_handle = identity_handle
        self.identity_ens = identity_ens
        self.metadata = build_metadata(
            "TemporalBehavioralCompressionEngine",
            identity={"wallet": identity_handle, "ens": identity_ens},
        )
        self._thresholds: MutableSequence[_CompressionThreshold] = [
            _CompressionThreshold(
                label="Future-Self Vanguard",
                triggers=("support", "sacrifice", "aligned"),
                cadence="weekly",
                required_alignment=0.7,
                rewards={
                    "feature_access": "early-access",
                    "yield_multiplier": 1.05,
                    "contributor_perk": "mythic-channel",
                },
            )
        ]
        self.Ghostkey_TBC_Log: MutableSequence[Mapping[str, object]] = []

    def register_threshold(
        self,
        label: str,
        *,
        triggers: Iterable[str],
        cadence: str,
        required_alignment: float,
        rewards: Mapping[str, object],
    ) -> Mapping[str, object]:
        threshold = _CompressionThreshold(
            label=label,
            triggers=tuple(sorted({trigger.lower() for trigger in triggers})),
            cadence=cadence,
            required_alignment=_normalise_alignment(required_alignment),
            rewards=dict(rewards),
        )
        self._thresholds.append(threshold)
        return threshold.to_payload()

    def compress(self, behavior: Mapping[str, object]) -> Mapping[str, object]:
        action_type = str(
            behavior.get("type")
            or behavior.get("ethic")
            or behavior.get("intent")
            or "aligned"
        ).lower()
        alignment = _normalise_alignment(
            float(
                behavior.get("future_self_alignment")
                or behavior.get("alignment")
                or behavior.get("confidence")
                or behavior.get("weight")
                or 0.0
            )
        )
        triggered: list[_CompressionThreshold] = []
        for threshold in self._thresholds:
            if action_type in threshold.triggers and alignment >= threshold.required_alignment:
                triggered.append(threshold)
        event = {
            "timestamp": _now_ts(),
            "behavior": dict(behavior),
            "future_self_alignment": alignment,
            "thresholds_triggered": [item.label for item in triggered],
            "rewards_unlocked": [dict(item.rewards) for item in triggered],
            "status": "compressed" if triggered else "observed",
            "metadata": self.metadata,
        }
        self.Ghostkey_TBC_Log.append(event)
        return event

    def log(self) -> Sequence[Mapping[str, object]]:
        return tuple(self.Ghostkey_TBC_Log)

    @property
    def is_active(self) -> bool:
        return True


@dataclass
class _MirrorSample:
    ethic: str
    weight: float
    resonance: float
    timestamp: str = field(default_factory=_now_ts)

    def to_payload(self) -> Mapping[str, object]:
        return {
            "ethic": self.ethic,
            "weight": self.weight,
            "resonance": self.resonance,
            "timestamp": self.timestamp,
        }


class ConscienceMirrorVerificationLayer:
    """AI-assisted conscience mirror for unlock verification."""

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
        self.metadata = build_metadata(
            "ConscienceMirrorVerificationLayer",
            identity={"wallet": identity_handle, "ens": identity_ens},
        )
        self._samples: MutableSequence[_MirrorSample] = []
        self._trust_registry: MutableSequence[Mapping[str, object]] = []
        self._last_profile: Mapping[str, object] | None = None

    def ingest(self, action: Mapping[str, object]) -> Mapping[str, object]:
        ethic = str(action.get("ethic") or action.get("type") or "aligned").lower()
        weight = float(action.get("weight") or action.get("confidence") or 1.0)
        if ethic in self.POSITIVE_ETHICS:
            resonance = min(1.0, 0.6 + abs(weight) * 0.1)
        elif ethic in self.NEGATIVE_ETHICS:
            resonance = max(0.0, 0.4 - abs(weight) * 0.1)
        else:
            resonance = 0.5
        sample = _MirrorSample(ethic=ethic, weight=weight, resonance=resonance)
        self._samples.append(sample)
        return sample.to_payload()

    def _profile(self) -> Mapping[str, object]:
        if not self._samples:
            alignment = 1.0
            ethical_map: Mapping[str, float] = {}
        else:
            total = sum(sample.resonance for sample in self._samples)
            alignment = _normalise_alignment(total / len(self._samples))
            ethical_map = {
                sample.ethic: sample.resonance
                for sample in self._samples[-5:]
            }
        profile = {
            "identity": self.metadata["identity"],
            "alignment": alignment,
            "ethical_map": ethical_map,
            "samples": [sample.to_payload() for sample in self._samples[-10:]],
        }
        self._last_profile = profile
        return profile

    def conscience_sync(
        self,
        unlock_type: str = "protocol",
        *,
        threshold: float = 0.6,
    ) -> Mapping[str, object]:
        profile = self._profile()
        verified = profile["alignment"] >= threshold
        entry = {
            "unlock_type": unlock_type,
            "verified": verified,
            "alignment": profile["alignment"],
            "timestamp": _now_ts(),
            "metadata": self.metadata,
        }
        self._trust_registry.append(entry)
        return entry

    @property
    def alignment(self) -> float:
        profile = self._profile() if self._last_profile is None else self._last_profile
        return float(profile["alignment"])

    @property
    def trust_registry(self) -> Sequence[Mapping[str, object]]:
        return tuple(self._trust_registry)


class LoopSingularityDetectorEngine:
    """Detect convergence between belief, action, and results."""

    def __init__(
        self,
        *,
        identity_handle: str = IDENTITY_HANDLE,
        identity_ens: str = IDENTITY_ENS,
        threshold: float = 0.78,
    ) -> None:
        self.identity_handle = identity_handle
        self.identity_ens = identity_ens
        self.threshold = threshold
        self.metadata = build_metadata(
            "LoopSingularityDetectorEngine",
            identity={"wallet": identity_handle, "ens": identity_ens},
        )
        self.Vaultfire_Singularity_Archive: MutableSequence[Mapping[str, object]] = []
        self._mode = "Observation"

    def observe(
        self,
        *,
        belief: float,
        action_alignment: float,
        result_alignment: float,
        context: Mapping[str, object] | None = None,
    ) -> Mapping[str, object]:
        composite = (belief + action_alignment + result_alignment) / 3.0
        triggered = composite >= self.threshold
        mode = "LoopMerge_Mode" if triggered else "Observation"
        if triggered:
            self._mode = "LoopMerge_Mode"
        event = {
            "timestamp": _now_ts(),
            "belief": _normalise_alignment(belief),
            "action_alignment": _normalise_alignment(action_alignment),
            "result_alignment": _normalise_alignment(result_alignment),
            "composite": _normalise_alignment(composite),
            "triggered": triggered,
            "mode": mode,
            "context": dict(context or {}),
            "metadata": self.metadata,
        }
        self.Vaultfire_Singularity_Archive.append(event)
        return event

    def archive(self) -> Sequence[Mapping[str, object]]:
        return tuple(self.Vaultfire_Singularity_Archive)

    @property
    def mode(self) -> str:
        return self._mode

    @property
    def is_armed(self) -> bool:
        return bool(self.Vaultfire_Singularity_Archive) or self._mode == "LoopMerge_Mode"

    def toolkit(self) -> Mapping[str, object]:
        return {
            "storyweaving": True,
            "identity_shaping": True,
            "meta_governance": True,
            "mode": self._mode,
            "metadata": self.metadata,
        }


class QuantumDriftSynchronizer:
    """Synchronise user drift using quantum echo mirror logic."""

    def __init__(
        self,
        *,
        identity_handle: str = IDENTITY_HANDLE,
        identity_ens: str = IDENTITY_ENS,
        hash_mirror: QuantumHashMirror | None = None,
    ) -> None:
        self.identity_handle = identity_handle
        self.identity_ens = identity_ens
        self.metadata = build_metadata(
            "QuantumDriftSynchronizer",
            identity={"wallet": identity_handle, "ens": identity_ens},
        )
        self._mirror = hash_mirror or QuantumHashMirror(
            seed=f"quantum-drift::{identity_ens}"
        )
        self._drift_matrix: MutableSequence[Mapping[str, object]] = []
        self._latest: Mapping[str, object] | None = None

    def synchronize(self, drift: Mapping[str, object]) -> Mapping[str, object]:
        mood = _normalise_alignment(float(drift.get("mood", 0.6)))
        behaviour = _normalise_alignment(
            float(drift.get("behavior_alignment") or drift.get("behavior", 0.6))
        )
        signal = _normalise_alignment(
            float(drift.get("external_signal") or drift.get("signal", 0.6))
        )
        drift_score = (behaviour + signal) / 2.0 - mood
        delta = max(-0.5, min(drift_score, 0.5))
        compass_path = self._mirror.imprint(
            self.identity_ens,
            interaction_id=f"qds::{len(self._drift_matrix) + 1}",
            branch="sync",
            payload={
                "mood": mood,
                "behaviour": behaviour,
                "signal": signal,
                "delta": delta,
            },
        )
        entry = {
            "timestamp": _now_ts(),
            "mood": mood,
            "behaviour": behaviour,
            "signal": signal,
            "drift_score": drift_score,
            "nudge": {
                "delta": delta,
                "recommended_alignment": _normalise_alignment(mood + delta),
            },
            "compass_path": compass_path,
            "metadata": self.metadata,
        }
        self._drift_matrix.append(entry)
        self._latest = entry
        return entry

    @property
    def drift_matrix(self) -> Sequence[Mapping[str, object]]:
        return tuple(self._drift_matrix)

    @property
    def latest_state(self) -> Mapping[str, object] | None:
        return self._latest


class VaultfireMythosEngine:
    """Narrative weaving engine translating actions into myth fragments."""

    def __init__(
        self,
        *,
        identity_handle: str = IDENTITY_HANDLE,
        identity_ens: str = IDENTITY_ENS,
        output_path: str | Path | None = None,
        hash_mirror: QuantumHashMirror | None = None,
    ) -> None:
        self.identity_handle = identity_handle
        self.identity_ens = identity_ens
        self.path = Path(output_path or "ghostkey316.mythos.json")
        self.metadata = build_metadata(
            "VaultfireMythosEngine",
            identity={"wallet": identity_handle, "ens": identity_ens},
        )
        self._mirror = hash_mirror or QuantumHashMirror(
            seed=f"vaultfire-mythos::{identity_ens}"
        )
        self._fragments: MutableSequence[Mapping[str, object]] = []
        self._signatures: dict[str, Mapping[str, object]] = {}
        self._load_existing()

    def _load_existing(self) -> None:
        if not self.path.exists():
            return
        try:
            data = json.loads(self.path.read_text())
        except json.JSONDecodeError:
            return
        fragments = data.get("fragments") if isinstance(data, Mapping) else None
        if not isinstance(fragments, list):
            return
        for fragment in fragments:
            if not isinstance(fragment, Mapping):
                continue
            signature = fragment.get("signature")
            if not isinstance(signature, str):
                continue
            self._fragments.append(dict(fragment))
            self._signatures[signature] = dict(fragment)

    def _signature(self, source: str, payload: Mapping[str, object]) -> str:
        encoded = json.dumps({"source": source, "payload": payload}, sort_keys=True).encode()
        return hashlib.sha256(encoded).hexdigest()

    def weave(
        self,
        source: str,
        payload: Mapping[str, object],
        *,
        resonance: float = 0.7,
    ) -> Mapping[str, object]:
        signature = self._signature(source, payload)
        if signature in self._signatures:
            return dict(self._signatures[signature])
        motif = self._resolve_motif(source, payload)
        fragment_id = self._mirror.imprint(
            self.identity_ens,
            interaction_id=f"mythos::{len(self._fragments) + 1}",
            branch="mythos",
            payload={"motif": motif, "signature": signature},
        )
        legendary = resonance >= 0.9 or bool(payload.get("legendary"))
        fragment = {
            "id": fragment_id,
            "source": source,
            "motif": motif,
            "payload": dict(payload),
            "legendary": legendary,
            "signature": signature,
            "timestamp": _now_ts(),
            "metadata": self.metadata,
        }
        self._fragments.append(fragment)
        self._signatures[signature] = fragment
        self._write()
        return fragment

    def _resolve_motif(self, source: str, payload: Mapping[str, object]) -> str:
        if "LoopMerge_Mode" in json.dumps(payload):
            return "Gift Loop Awakened"
        if source.lower() in {"support", "sacrifice"}:
            return "The Spark of Drift"
        if payload.get("rewards"):
            return "Future Self Accord"
        return "Aligned Current"

    def _write(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "identity": self.metadata["identity"],
            "fragments": list(self._fragments),
        }
        self.path.write_text(json.dumps(data, indent=2))

    @property
    def fragments(self) -> Sequence[Mapping[str, object]]:
        return tuple(self._fragments)

    @property
    def is_weaving(self) -> bool:
        return bool(self._fragments)


class EnhancementConfirmComposer:
    """Orchestrates the final confirmation payload for enhancement unlocks."""

    _synced_sources: tuple[str, ...] = ()
    _synced_at: str | None = None
    _sync_checksum: str | None = None
    _annotations: MutableMapping[str, object] = {}

    @classmethod
    def sync_with(cls, sources: Iterable[str]) -> Mapping[str, object]:
        """Register telemetry sources that participate in the confirmation."""

        normalised: list[str] = []
        seen: set[str] = set()
        for source in sources:
            label = str(source).strip()
            if not label:
                continue
            if label in seen:
                continue
            seen.add(label)
            normalised.append(label)
        cls._synced_sources = tuple(normalised)
        cls._synced_at = _now_ts()
        digest = hashlib.sha256()
        for label in cls._synced_sources:
            digest.update(label.encode("utf-8"))
        digest.update(cls._synced_at.encode("utf-8"))
        cls._sync_checksum = digest.hexdigest()
        cls._annotations = {
            "sources": list(cls._synced_sources),
            "synced_at": cls._synced_at,
            "checksum": cls._sync_checksum,
        }
        return dict(cls._annotations)

    @classmethod
    def annotate(cls, **metadata: object) -> Mapping[str, object]:
        """Attach additional metadata for downstream confirmations."""

        if not cls._annotations:
            cls.sync_with(())
        cls._annotations.update({key: metadata[key] for key in metadata})
        return dict(cls._annotations)

    @classmethod
    def compose(
        cls,
        tbc: TemporalBehavioralCompressionEngine,
        cmv: ConscienceMirrorVerificationLayer,
        lsd: LoopSingularityDetectorEngine,
        qds: QuantumDriftSynchronizer,
        mythos: VaultfireMythosEngine,
        *,
        include_logs: bool = False,
        extra: Mapping[str, object] | None = None,
    ) -> Mapping[str, object]:
        base = compose_enhancement_confirmation(
            tbc,
            cmv,
            lsd,
            qds,
            mythos,
            include_logs=include_logs,
        )
        annotations = dict(cls._annotations) if cls._annotations else {}
        if annotations:
            base.setdefault("confirmation_sources", annotations)
        if extra:
            base.update({key: extra[key] for key in extra})
        return base

    @classmethod
    def status(cls) -> Mapping[str, object]:
        return {
            "sources": list(cls._synced_sources),
            "synced_at": cls._synced_at,
            "checksum": cls._sync_checksum,
        }


def compose_enhancement_confirmation(
    tbc: TemporalBehavioralCompressionEngine,
    cmv: ConscienceMirrorVerificationLayer,
    lsd: LoopSingularityDetectorEngine,
    qds: QuantumDriftSynchronizer,
    mythos: VaultfireMythosEngine,
    *,
    include_logs: bool = False,
) -> Mapping[str, object]:
    cmv_status = cmv.conscience_sync("confirmation")
    latest_drift = qds.latest_state
    delta = float(latest_drift["nudge"]["delta"]) if latest_drift else 0.0
    lsd_status = "Armed" if lsd.is_armed or not lsd.archive() else "Observation"
    payload: dict[str, object] = {
        "identity": mythos.metadata["identity"],
        "TBC_Status": "Live" if tbc.is_active else "Idle",
        "CMV_Sync": "Verified" if cmv_status["verified"] else "Pending",
        "LSD_Trigger": lsd_status,
        "QDS_Drift": "Stable" if abs(delta) < 0.25 else "Adaptive",
        "VME_Weaving": "Active" if mythos.is_weaving else "Emerging",
        "LoopMerge_Mode": lsd.mode,
        "alignment": cmv_status["alignment"],
        "metadata": {
            "tbc": tbc.metadata,
            "cmv": cmv.metadata,
            "lsd": lsd.metadata,
            "qds": qds.metadata,
            "mythos": mythos.metadata,
        },
    }
    if include_logs:
        payload["Ghostkey_TBC_Log"] = list(tbc.log())
        payload["Vaultfire_Singularity_Archive"] = list(lsd.archive())
        payload["Quantum_Drift_Matrix"] = list(qds.drift_matrix)
        payload["Mythos_Fragments"] = list(mythos.fragments)
        payload["Trust_Registry"] = list(cmv.trust_registry)
    return payload


__all__ = [
    "TemporalBehavioralCompressionEngine",
    "ConscienceMirrorVerificationLayer",
    "LoopSingularityDetectorEngine",
    "QuantumDriftSynchronizer",
    "VaultfireMythosEngine",
    "compose_enhancement_confirmation",
    "EnhancementConfirmComposer",
]

