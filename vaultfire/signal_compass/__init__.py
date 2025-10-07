"""Signal Compass primitives for orchestrating Vaultfire guidance loops."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, Iterable, List, Mapping, Optional


class SignalPulse:
    """Capture live telemetry about a participant's signal feed.

    Parameters
    ----------
    identity:
        Unique identifier for the pulse stream. Typically a user tag or
        instrument ID.
    input_feed:
        The upstream feed name this pulse is subscribed to.
    sample_window:
        Number of historical readings to retain for quick reference.
    """

    def __init__(
        self,
        identity: str,
        input_feed: str,
        *,
        sample_window: int = 5,
    ) -> None:
        if not identity:
            raise ValueError("SignalPulse requires a non-empty identity")
        if not input_feed:
            raise ValueError("SignalPulse requires a non-empty input_feed")
        if sample_window <= 0:
            raise ValueError("sample_window must be positive")

        self.identity = identity
        self.input_feed = input_feed
        self.sample_window = sample_window
        self._history: List[Mapping[str, object]] = []
        self.is_listening: bool = False

    def activate(self) -> Mapping[str, object]:
        """Start listening to the upstream feed and capture an initial reading."""

        reading = self._capture_reading()
        self.is_listening = True
        self._remember(reading)
        return reading

    def snapshot(self) -> Mapping[str, object]:
        """Return the latest reading, activating the pulse if needed."""

        if not self.is_listening:
            return self.activate()
        if not self._history:
            return self.activate()
        return self._history[-1]

    def _capture_reading(self) -> Mapping[str, object]:
        """Synthesize a lightweight reading for downstream components."""

        timestamp = datetime.now(timezone.utc)
        strength = 1.0
        return {
            "identity": self.identity,
            "feed": self.input_feed,
            "timestamp": timestamp,
            "signal_strength": strength,
            "status": "listening",
        }

    def _remember(self, reading: Mapping[str, object]) -> None:
        self._history.append(dict(reading))
        # Keep history within window bounds.
        overflow = len(self._history) - self.sample_window
        if overflow > 0:
            del self._history[:overflow]


class MoralVector:
    """Translate pulse snapshots into alignment projections."""

    def __init__(
        self,
        *,
        reference_framework: str,
        priority: Iterable[str],
    ) -> None:
        priorities = tuple(priority)
        if not reference_framework:
            raise ValueError("reference_framework must be provided")
        if not priorities:
            raise ValueError("priority must contain at least one axis")

        self.reference_framework = reference_framework
        self.priority = priorities

    def project(self, reading: Mapping[str, object]) -> Mapping[str, float]:
        """Derive a normalized value for each priority axis.

        The projection is intentionally simple: each subsequent axis is
        slightly discounted to maintain a directional bias that favours the
        earliest priorities.
        """

        signal_strength = float(reading.get("signal_strength", 1.0))
        base = min(max(signal_strength, 0.0), 1.0)
        projection: Dict[str, float] = {}
        for index, axis in enumerate(self.priority):
            decay = 0.9 ** index
            projection[axis] = round(min(1.0, base * decay), 3)
        return projection


class HesitationLens:
    """Flag potential hesitation by comparing projection scores."""

    def __init__(self, *, trigger_threshold: float, retro_echo_boost: bool = False) -> None:
        if not 0.0 < trigger_threshold <= 1.0:
            raise ValueError("trigger_threshold must be within (0, 1]")
        self.trigger_threshold = trigger_threshold
        self.retro_echo_boost = retro_echo_boost

    def inspect(self, projection: Mapping[str, float]) -> Mapping[str, object]:
        if not projection:
            return {
                "average_alignment": 0.0,
                "threshold": self._effective_threshold(),
                "flagged": True,
            }

        values = list(projection.values())
        average = sum(values) / len(values)
        threshold = self._effective_threshold()
        flagged = average < threshold
        return {
            "average_alignment": round(average, 3),
            "threshold": round(threshold, 3),
            "flagged": flagged,
        }

    def _effective_threshold(self) -> float:
        if not self.retro_echo_boost:
            return self.trigger_threshold
        # Retro echo slightly lowers the trigger threshold, allowing small dips to
        # pass when historical resonance is favourable.
        return self.trigger_threshold * 0.9


class CompassRing:
    """Orchestrate the interaction between pulse, vector, and lens."""

    def __init__(self, pulse: SignalPulse, vector: MoralVector, lens: HesitationLens) -> None:
        if not isinstance(pulse, SignalPulse):
            raise TypeError("pulse must be an instance of SignalPulse")
        if not isinstance(vector, MoralVector):
            raise TypeError("vector must be an instance of MoralVector")
        if not isinstance(lens, HesitationLens):
            raise TypeError("lens must be an instance of HesitationLens")

        self.pulse = pulse
        self.vector = vector
        self.lens = lens
        self.status = "IDLE"
        self._last_frame: Optional[Mapping[str, object]] = None

    def calibrate(self) -> Mapping[str, object]:
        reading = self.pulse.snapshot()
        projection = self.vector.project(reading)
        hesitation = self.lens.inspect(projection)
        frame = {
            "signal": reading,
            "projection": projection,
            "hesitation": hesitation,
            "framework": self.vector.reference_framework,
        }
        self._last_frame = frame
        return frame

    def display(self, *, mode: str = "overlay", sync: str = "live") -> Mapping[str, object]:
        """Prepare a frame for UI rendering and mark the compass as live."""

        frame = self.calibrate()
        frame.update({
            "mode": mode,
            "sync": sync,
        })
        self.status = "LIVE"
        return frame

    @property
    def last_frame(self) -> Optional[Mapping[str, object]]:
        return self._last_frame


__all__ = [
    "SignalPulse",
    "MoralVector",
    "HesitationLens",
    "CompassRing",
]
