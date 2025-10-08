"""Heartbeat-driven entropy generator for Vaultfire cloaking."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Dict, Iterable, List, Sequence, Tuple

from utils.entropy_seed import EntropySeed, EntropySnapshot


@dataclass(frozen=True)
class PulseFrame:
    """Represents a heartbeat emission from :class:`CloakPulse`."""

    heartbeat: int
    entropy_hex: str
    timestamp: datetime
    noise_vector: Tuple[float, ...]
    signature: str
    lineage: str


class CloakPulse:
    """Heartbeat aware entropy generator.

    The pulse stream is deterministic when the underlying :class:`EntropySeed`
    is initialised with a fixed seed. Each emitted frame is captured when debug
    mode is enabled which aligns with the audit expectations defined in the
    Vaultfire v1.0 release notes.
    """

    def __init__(
        self,
        seed: EntropySeed | None = None,
        *,
        lineage: str = "Ghostkey-316",
        debug: bool = False,
    ) -> None:
        self._seed = seed or EntropySeed()
        self._lineage = lineage
        self._debug = debug
        self._history: List[PulseFrame] = []

    @property
    def debug(self) -> bool:
        """Return whether debug capture is enabled."""

        return self._debug

    def set_debug(self, enabled: bool) -> None:
        """Toggle debug capture."""

        self._debug = enabled
        self._seed.set_debug(enabled)
        if not enabled:
            self._history.clear()

    def emit(self, *, context: str = "", width: int | None = None) -> PulseFrame:
        """Emit a pulse frame for the provided context."""

        snapshot = self._seed.pulse(context=context, width=width or 4)
        frame = self._to_frame(snapshot)
        if self._debug:
            self._history.append(frame)
        return frame

    def blend_signatures(
        self, signatures: Iterable[str], *, context: str = ""
    ) -> str:
        """Blend a set of signatures into a deterministic cloaked signature."""

        return self._seed.derive_signature(signatures, context=context)

    def audit_trail(self) -> Sequence[PulseFrame]:
        """Return recorded frames when debug capture is active."""

        return tuple(self._history)

    def debug_snapshot(self) -> Dict[str, object]:
        """Return a snapshot of the current heartbeat state."""

        frames = self.audit_trail()
        if not frames:
            return {"lineage": self._lineage, "heartbeats": 0}
        latest = frames[-1]
        return {
            "lineage": self._lineage,
            "heartbeats": len(frames),
            "last_entropy": latest.entropy_hex,
            "last_signature": latest.signature,
        }

    def _to_frame(self, snapshot: EntropySnapshot) -> PulseFrame:
        return PulseFrame(
            heartbeat=snapshot.heartbeat,
            entropy_hex=snapshot.entropy_hex,
            timestamp=snapshot.timestamp,
            noise_vector=snapshot.vector,
            signature=snapshot.signature,
            lineage=self._lineage,
        )


__all__ = ["CloakPulse", "PulseFrame"]
