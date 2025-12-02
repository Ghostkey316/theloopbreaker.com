"""Vaultfire Identity Layer v1.0 bindings and exports."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Mapping, MutableMapping, Sequence

from vaultfire.memory import MemoryThreadCore, TimePulseSync
from vaultfire.memory.modules.memory_thread import MemoryEvent
from vaultfire.sensation import SenseWeaveCore
from vaultfire.soul import GhostSealProtocol
from vaultfire.soul.soulprint_core import SoulPrint, SoulPrintCore


@dataclass(frozen=True)
class IdentityAnchor:
    """Normalized representation of a Vaultfire identity."""

    persona_tag: str
    soulprint_hash: str
    identifiers: Mapping[str, tuple[str, ...]]
    snapshots: tuple[str, ...]
    identity_hash: str

    def export(self) -> Mapping[str, object]:
        return {
            "persona_tag": self.persona_tag,
            "soulprint": self.soulprint_hash,
            "identifiers": {key: list(values) for key, values in self.identifiers.items()},
            "snapshots": list(self.snapshots),
            "identity_hash": self.identity_hash,
        }


@dataclass(frozen=True)
class BeliefScore:
    """Weighted belief metrics derived from identity activity."""

    frequency: float
    resonance: float
    ethics: float
    continuity: float
    composite: float

    def export(self) -> Mapping[str, float]:
        return {
            "frequency": self.frequency,
            "resonance": self.resonance,
            "ethics": self.ethics,
            "continuity": self.continuity,
            "composite": self.composite,
        }


class IdentityWeaveCore:
    """Bind SoulPrint snapshots with persona tags and unified identifiers."""

    def __init__(self, *, soul_core: SoulPrintCore | None = None) -> None:
        self.soul_core = soul_core or SoulPrintCore()
        self._anchors: MutableMapping[str, IdentityAnchor] = {}

    def _normalize_tag(self, persona_tag: str) -> str:
        tag = persona_tag.strip()
        if not tag:
            raise ValueError("persona_tag must be provided")
        return tag.lower()

    def _normalize_value(self, value: str) -> str:
        cleaned = value.strip()
        if cleaned.startswith("@"):
            cleaned = cleaned[1:]
        return cleaned.lower()

    def _normalize_identifiers(
        self, identifiers: Mapping[str, Sequence[str] | str] | None
    ) -> Mapping[str, tuple[str, ...]]:
        normalized: MutableMapping[str, set[str]] = {
            "social": set(),
            "wallets": set(),
            "ens": set(),
            "system": set(),
        }
        if identifiers:
            for key, values in identifiers.items():
                bucket = normalized.get(key.lower())
                if bucket is None:
                    continue
                if isinstance(values, str):
                    values = (values,)
                for value in values:
                    cleaned = self._normalize_value(str(value))
                    if cleaned:
                        bucket.add(cleaned)
        return {key: tuple(sorted(values)) for key, values in normalized.items() if values}

    def _merge_identifiers(
        self,
        existing: Mapping[str, tuple[str, ...]] | None,
        incoming: Mapping[str, tuple[str, ...]],
    ) -> Mapping[str, tuple[str, ...]]:
        merged: MutableMapping[str, set[str]] = {
            key: set(values) for key, values in (existing or {}).items()
        }
        for key, values in incoming.items():
            merged.setdefault(key, set()).update(values)
        return {key: tuple(sorted(values)) for key, values in merged.items() if values}

    def _identity_hash(
        self, persona_tag: str, snapshots: Sequence[str], identifiers: Mapping[str, tuple[str, ...]]
    ) -> str:
        payload = {
            "persona": persona_tag,
            "snapshots": tuple(sorted(snapshots)),
            "identifiers": {key: tuple(values) for key, values in sorted(identifiers.items())},
        }
        serialized = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
        return hashlib.blake2s(serialized, person=b"VF-IDv1").hexdigest()

    def bind_snapshot(
        self,
        persona_tag: str,
        *,
        soulprint: SoulPrint,
        identifiers: Mapping[str, Sequence[str] | str] | None = None,
    ) -> IdentityAnchor:
        tag = self._normalize_tag(persona_tag)
        normalized_identifiers = self._normalize_identifiers(identifiers)
        existing = self._anchors.get(tag)
        snapshots = list(existing.snapshots) if existing else []
        if soulprint.hash not in snapshots:
            snapshots.append(soulprint.hash)
        merged_identifiers = self._merge_identifiers(existing.identifiers if existing else None, normalized_identifiers)
        identity_hash = self._identity_hash(tag, snapshots, merged_identifiers)
        anchor = IdentityAnchor(
            persona_tag=tag,
            soulprint_hash=soulprint.hash,
            identifiers=merged_identifiers,
            snapshots=tuple(snapshots),
            identity_hash=identity_hash,
        )
        self._anchors[tag] = anchor
        return anchor

    def merge_identity(
        self, persona_tag: str, *, identifiers: Mapping[str, Sequence[str] | str]
    ) -> IdentityAnchor:
        existing = self._anchors.get(self._normalize_tag(persona_tag))
        if existing is None:
            raise ValueError("persona_tag must be bound before merging identifiers")
        normalized = self._normalize_identifiers(identifiers)
        merged_identifiers = self._merge_identifiers(existing.identifiers, normalized)
        identity_hash = self._identity_hash(existing.persona_tag, existing.snapshots, merged_identifiers)
        anchor = IdentityAnchor(
            persona_tag=existing.persona_tag,
            soulprint_hash=existing.soulprint_hash,
            identifiers=merged_identifiers,
            snapshots=existing.snapshots,
            identity_hash=identity_hash,
        )
        self._anchors[existing.persona_tag] = anchor
        return anchor

    def get_anchor(self, persona_tag: str) -> IdentityAnchor | None:
        return self._anchors.get(self._normalize_tag(persona_tag))


class BeliefScoreEngine:
    """Weight identity activity to generate belief-aligned metrics."""

    def _clamp(self, value: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
        return max(minimum, min(maximum, round(value, 4)))

    def _continuity_weight(
        self, anchor: IdentityAnchor, continuity_threads: Sequence[Mapping[str, object]] | None
    ) -> float:
        if not continuity_threads:
            return self._clamp(len(anchor.snapshots) / 5)
        weights: list[float] = []
        for thread in continuity_threads:
            raw_weight = thread.get("weight") or thread.get("belief") or 0.5
            try:
                weights.append(float(raw_weight))
            except (TypeError, ValueError):
                continue
        if not weights:
            return self._clamp(0.5)
        return self._clamp(sum(weights) / len(weights))

    def compute(
        self,
        anchor: IdentityAnchor,
        *,
        activity_frequency: float,
        resonance_trail: Sequence[float],
        ethics_alignment: float,
        continuity_threads: Sequence[Mapping[str, object]] | None = None,
    ) -> BeliefScore:
        frequency = self._clamp((activity_frequency + len(anchor.snapshots)) / 10)
        resonance = self._clamp(sum(resonance_trail) / max(len(resonance_trail), 1))
        ethics = self._clamp(ethics_alignment)
        continuity = self._continuity_weight(anchor, continuity_threads)
        composite = round(
            316.0
            * (
                0.4 * frequency
                + 0.35 * resonance
                + 0.15 * ethics
                + 0.1 * continuity
            ),
            2,
        )
        return BeliefScore(
            frequency=frequency,
            resonance=resonance,
            ethics=ethics,
            continuity=continuity,
            composite=composite,
        )


class IdentityEchoBridge:
    """Mirror identity anchors across sensation and memory logs."""

    def __init__(
        self,
        *,
        memory_core: MemoryThreadCore | None = None,
        sense_core: SenseWeaveCore | None = None,
        belief_engine: BeliefScoreEngine | None = None,
        time_pulse: TimePulseSync | None = None,
    ) -> None:
        self.sense_core = sense_core or SenseWeaveCore()
        self.memory_core = memory_core or MemoryThreadCore(
            sense_core=self.sense_core, time_pulse=time_pulse or TimePulseSync()
        )
        self.belief_engine = belief_engine or BeliefScoreEngine()

    def mirror(
        self,
        anchor: IdentityAnchor,
        *,
        prompt: str,
        heart_rate: float,
        galvanic_skin_response: float,
        voice_tremor: float,
        emotional_delta: Mapping[str, float] | None = None,
        ethics_alignment: float = 1.0,
    ) -> Mapping[str, object]:
        event: MemoryEvent = self.memory_core.record_memory(
            anchor.persona_tag,
            prompt=prompt,
            heart_rate=heart_rate,
            galvanic_skin_response=galvanic_skin_response,
            voice_tremor=voice_tremor,
            emotional_delta=emotional_delta,
        )
        thread = self.memory_core.thread(anchor.persona_tag)
        belief = self.belief_engine.compute(
            anchor,
            activity_frequency=len(thread),
            resonance_trail=(event.resonance.sensation_score / 316.0,),
            ethics_alignment=ethics_alignment,
            continuity_threads=[evt.payload for evt in thread],
        )
        return {
            "identity_hash": anchor.identity_hash,
            "memory_hash": event.memory_hash,
            "resonance": event.resonance.hash,
            "belief": belief.export(),
            "continuity_profile": event.anchor.to_payload(),
        }


class PersonaMintCLI:
    """Export verified identities with belief score metadata."""

    def __init__(
        self,
        *,
        identity_core: IdentityWeaveCore | None = None,
        belief_engine: BeliefScoreEngine | None = None,
        ghostseal: GhostSealProtocol | None = None,
    ) -> None:
        self.identity_core = identity_core or IdentityWeaveCore()
        self.belief_engine = belief_engine or BeliefScoreEngine()
        self.ghostseal = ghostseal or GhostSealProtocol()

    def _zk_proof(self, identity_hash: str) -> str:
        return hashlib.blake2s(identity_hash.encode(), person=b"VF-IDv1").hexdigest()

    def export(
        self,
        persona_tag: str,
        *,
        export_format: str = "json",
        zk_privacy: bool = False,
        resonance_trail: Sequence[float] | None = None,
        ethics_alignment: float = 1.0,
        continuity_threads: Sequence[Mapping[str, object]] | None = None,
    ) -> Mapping[str, object]:
        anchor = self.identity_core.get_anchor(persona_tag)
        if anchor is None:
            raise ValueError("persona_tag must be registered before export")
        resonance = resonance_trail or (1.0,)
        belief = self.belief_engine.compute(
            anchor,
            activity_frequency=len(anchor.snapshots),
            resonance_trail=resonance,
            ethics_alignment=ethics_alignment,
            continuity_threads=continuity_threads,
        )
        payload = {
            "persona": anchor.persona_tag,
            "identity_hash": anchor.identity_hash,
            "soulprints": list(anchor.snapshots),
            "identifiers": anchor.export()["identifiers"],
            "belief": belief.export(),
        }
        if zk_privacy:
            payload["zk_proof"] = self._zk_proof(anchor.identity_hash)
        if export_format == "json":
            return payload
        if export_format == "vault":
            sealed = self.ghostseal.export_bundle(payload, stealth=zk_privacy)
            sealed.update(
                {
                    "filename": f"{anchor.persona_tag.replace(' ', '_')}.vault",
                    "content_type": "application/x-vaultfire",
                }
            )
            return sealed
        raise ValueError("export_format must be 'json' or 'vault'")


__all__ = [
    "BeliefScore",
    "BeliefScoreEngine",
    "IdentityAnchor",
    "IdentityEchoBridge",
    "IdentityWeaveCore",
    "PersonaMintCLI",
]
