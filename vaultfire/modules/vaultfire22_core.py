"""Vaultfire v2.2 deployment primitives.

This module introduces the PulseMirror powered deployment core used by the
Vaultfire 2.2 codex extension. The implementation stitches together existing
cloaking utilities while enforcing the ethics-first defaults laid out in the
mission covenant files.
"""

from __future__ import annotations

from dataclasses import replace
from typing import Dict, Iterable, List, Mapping
import hashlib

from cloak_pulse import CloakPulse, PulseFrame
from consent_relay_graph import ConsentRelayGraph
from decoy_relay import DecoyRelay
from persona_drift import PersonaDrift
from signal_scrambler import SignalScrambler
from utils.entropy_seed import EntropySeed


def _frame_payload(frame: PulseFrame) -> Dict[str, object]:
    """Convert a :class:`PulseFrame` into a serialisable payload."""

    return {
        "heartbeat": frame.heartbeat,
        "entropy_hex": frame.entropy_hex,
        "timestamp": frame.timestamp.isoformat(),
        "noise_vector": list(frame.noise_vector),
        "signature": frame.signature,
        "lineage": frame.lineage,
    }


class PulseMirror:
    """Mirror a pulse frame across a reversible entropy surface."""

    def __init__(self, origin_pulse: PulseFrame) -> None:
        self.origin_pulse = origin_pulse
        self.mirrored_pulse = self._reflect_pulse(origin_pulse)

    def _reflect_pulse(self, frame: PulseFrame) -> PulseFrame:
        """Return a mirrored copy of *frame* with reversed entropy attributes."""

        mirrored_vector = tuple(reversed(frame.noise_vector))
        mirrored_lineage = f"{frame.lineage}::mirror"
        return replace(
            frame,
            entropy_hex=frame.entropy_hex[::-1],
            noise_vector=mirrored_vector,
            signature=frame.signature[::-1],
            lineage=mirrored_lineage,
        )

    def sync(self) -> Mapping[str, Mapping[str, object]]:
        """Return both pulse frames for downstream orchestration."""

        return {
            "origin": _frame_payload(self.origin_pulse),
            "mirror": _frame_payload(self.mirrored_pulse),
        }


class MetaFade:
    """Produce a deterministic fade signature for trace obfuscation."""

    def __init__(self, trace_id: str) -> None:
        if not trace_id:
            raise ValueError("trace_id must be provided for MetaFade")
        self.trace_id = trace_id

    def dissolve(self) -> str:
        digest = hashlib.sha3_256(self.trace_id.encode("utf-8")).hexdigest()
        # Every second character keeps the bleed effect predictable while
        # remaining non-reversible.
        return digest[::2]


class RealityWeaver:
    """Synthesize narrative scaffolding for public facing signals."""

    def __init__(self, anchor_hash: str) -> None:
        if not anchor_hash:
            raise ValueError("anchor_hash must be provided for RealityWeaver")
        self.anchor_hash = anchor_hash

    def generate_storyfield(self) -> str:
        digest = hashlib.sha3_256(self.anchor_hash.encode("utf-8")).hexdigest()
        return f"loop_{digest[:6]}_story"


class DriftGenome:
    """Encode belief signatures for downstream behavioural tokens."""

    def __init__(self, user_id: str) -> None:
        if not user_id:
            raise ValueError("user_id must be provided for DriftGenome")
        self.user_id = user_id

    def encode(self) -> str:
        digest = hashlib.sha3_256(self.user_id.encode("utf-8")).hexdigest()
        return f"ghostkey:{self.user_id}:{digest[:12]}"


class AntiHarvestGrid:
    """Track nodes that are protected against behavioural harvesting."""

    def __init__(self) -> None:
        self._nodes: List[str] = []

    def register(self, node_hash: str) -> None:
        node = str(node_hash)
        if node not in self._nodes:
            self._nodes.append(node)

    def extend(self, nodes: Iterable[str]) -> None:
        for node in nodes:
            self.register(node)

    def scan(self) -> List[str]:
        return [node for node in self._nodes if node.lower().startswith("bp")]


class Vaultfire22Core:
    """High level deployment facade for the Vaultfire 2.2 codex extension."""

    def __init__(
        self,
        user: str,
        *,
        entropy_seed: EntropySeed | None = None,
        consent_graph: ConsentRelayGraph | None = None,
        persona_drift: PersonaDrift | None = None,
        decoy_relay: DecoyRelay | None = None,
        signal_scrambler: SignalScrambler | None = None,
    ) -> None:
        if not user:
            raise ValueError("user must be provided for Vaultfire22Core")

        self.user = user
        self.entropy_seed = entropy_seed or EntropySeed()
        self.pulse = CloakPulse(self.entropy_seed, lineage="Vaultfire22")
        self._origin_frame = self.pulse.emit(context=user)
        self.mirror = PulseMirror(self._origin_frame)
        self.fade = MetaFade(user)
        self.narrative = RealityWeaver(user)
        self.genome = DriftGenome(user)
        self.anti_harvest = AntiHarvestGrid()
        self.anti_harvest.register(user)

        self.consent_graph = consent_graph
        self.persona_drift = persona_drift
        self.decoy_relay = decoy_relay
        self.signal_scrambler = signal_scrambler

    def deploy(self) -> Dict[str, object]:
        """Return an ethics-first payload ready for downstream tests."""

        return {
            "mirror_sync": self.mirror.sync(),
            "entropy_id": self._origin_frame.entropy_hex,
            "fade_trace": self.fade.dissolve(),
            "storyfield": self.narrative.generate_storyfield(),
            "ghost_signature": self.genome.encode(),
            "grid_status": self.anti_harvest.scan(),
        }


__all__ = [
    "PulseMirror",
    "MetaFade",
    "RealityWeaver",
    "DriftGenome",
    "AntiHarvestGrid",
    "Vaultfire22Core",
]

