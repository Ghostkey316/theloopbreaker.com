"""PulseSync helpers for real-time belief scoring."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Mapping

from vaultfire.protocol.signal_echo import SignalEchoFrame


@dataclass(frozen=True)
class PulseSyncConfig:
    """Configuration values controlling the scoring model."""

    ethic_weights: Mapping[str, float]
    tag_bonus: float = 0.05
    intensity_weight: float = 0.6
    ethic_weight: float = 0.3
    coherence_weight: float = 0.1


class PulseSync:
    """Aggregate signal echo frames into a belief score."""

    DEFAULT_WEIGHTS: Mapping[str, float] = {
        "aligned": 0.25,
        "support": 0.2,
        "reinforce": 0.18,
        "monitor": -0.12,
        "drift": -0.2,
        "breach": -0.35,
        "override": -0.4,
    }

    def __init__(self, *, config: PulseSyncConfig | None = None) -> None:
        self._config = config or PulseSyncConfig(ethic_weights=self.DEFAULT_WEIGHTS)

    def score(self, frames: Iterable[SignalEchoFrame]) -> float:
        """Return a normalized belief score for ``frames``."""

        frames = list(frames)
        if not frames:
            return 0.0

        intensity = 0.0
        ethic = 0.0
        coherence = 0.0
        weight = 0.0

        for frame in frames:
            intensity += max(min(float(frame.intensity), 1.0), 0.0)
            ethic += self._config.ethic_weights.get(frame.ethic.lower(), -0.1)
            coherence += len(frame.tags) * self._config.tag_bonus
            weight += 1.0

        intensity /= weight
        ethic /= weight
        coherence /= weight

        score = (
            (intensity * self._config.intensity_weight)
            + (ethic * self._config.ethic_weight)
            + (coherence * self._config.coherence_weight)
        )
        return max(min(score, 1.0), -1.0)

