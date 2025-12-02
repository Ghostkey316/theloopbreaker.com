"""Sovereign Loop Bridge linking MirrorLayer and GhostOps."""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Callable, Iterable, List, Mapping, Sequence

from ghostops_v1.signal_cloak import SignalCloakConfig, SignalCloakSystem


@dataclass(slots=True)
class LoopPayload:
    """Payload relayed across MirrorLayer and GhostOps."""

    channel: str
    content: Mapping[str, object]
    fingerprint: str


class LoopBridge:
    """Relays reflection loops while enforcing cloak safety."""

    def __init__(
        self,
        mirror_channel: str,
        *,
        cloak: SignalCloakSystem | None = None,
        seed_callback: Callable[[str], None] | None = None,
    ) -> None:
        self.mirror_channel = mirror_channel
        self.cloak = cloak or SignalCloakSystem(SignalCloakConfig(mode="passive"))
        self.seed_callback = seed_callback
        self.seed_history: List[str] = []

    def relay_to_mirror(self, payload: Mapping[str, object]) -> LoopPayload:
        """Relay data to MirrorLayer using stealth cloak mode."""

        cloaked = self.cloak.with_mode("passive").obfuscate(str(payload))
        return LoopPayload(
            channel=self.mirror_channel,
            content=payload,
            fingerprint=cloaked["fingerprint"],
        )

    def relay_to_ghostops(self, payload: Mapping[str, object]) -> LoopPayload:
        """Relay data to GhostOps using active cloak mode for zero leakage."""

        cloaked = self.cloak.with_mode("active").obfuscate(str(payload))
        return LoopPayload(
            channel="ghostops",
            content={"mode": cloaked["mode"], "encoded": cloaked.get("encoded")},
            fingerprint=cloaked["fingerprint"],
        )

    def rotate_alignment_seed(self, seed: str) -> str:
        """Rotate alignment seeds and invoke the optional callback."""

        self.seed_history.append(seed)
        if self.seed_callback:
            self.seed_callback(seed)
        return seed

    @staticmethod
    def belief_entropy(beliefs: Sequence[float]) -> float:
        """Compute entropy of belief distribution for stability analysis."""

        cleaned = [b for b in beliefs if b > 0]
        total = sum(cleaned)
        if not cleaned or total == 0:
            return 0.0
        normalized = [b / total for b in cleaned]
        entropy = -sum(value * math.log(value, 2) for value in normalized)
        return round(entropy, 6)


__all__: Iterable[str] = ["LoopBridge", "LoopPayload"]
