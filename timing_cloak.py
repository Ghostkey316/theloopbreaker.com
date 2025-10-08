"""Adaptive timing cloak utilities for the Mirrorlock privacy layer."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
import random
import secrets
from typing import Iterable, List, Sequence


@dataclass(frozen=True)
class CloakedTrigger:
    """Represents a cloaked execution trigger."""

    original_index: int
    payload_signature: str
    scheduled_at: datetime
    delay_seconds: float


@dataclass(frozen=True)
class PacketDisguise:
    """Represents a disguised metadata signature."""

    original_size: int
    cloaked_size: int
    jitter_ratio: float


class TimingCloak:
    """Inject jitter and ordering camouflage for behavioral observability."""

    def __init__(self, *, seed: int | None = None) -> None:
        self._random = random.Random(seed or secrets.randbits(64))

    def _signature(self, payload: object) -> str:
        base = repr(payload).encode("utf-8")
        digest = random.Random(hash(base)).randint(0, 1 << 30)
        return f"sig-{digest:08x}"

    def disperse(
        self,
        events: Sequence[object],
        *,
        base_timestamp: datetime | None = None,
        jitter_window: Sequence[float] = (0.35, 1.75),
    ) -> List[CloakedTrigger]:
        """Return cloaked triggers with randomized delays and ordering."""

        if not events:
            return []

        lower, upper = jitter_window
        if lower < 0 or upper <= 0 or upper < lower:
            raise ValueError("jitter_window must contain positive, ascending values")

        base_time = base_timestamp or datetime.utcnow()
        scheduled: List[CloakedTrigger] = []
        cumulative = base_time
        for index, payload in enumerate(events):
            jitter = self._random.uniform(lower, upper)
            cumulative = cumulative + timedelta(seconds=jitter)
            trigger = CloakedTrigger(
                original_index=index,
                payload_signature=self._signature(payload),
                scheduled_at=cumulative,
                delay_seconds=jitter,
            )
            scheduled.append(trigger)

        self._random.shuffle(scheduled)
        scheduled.sort(key=lambda item: item.scheduled_at)
        return scheduled

    def obscure_packet_size(self, packet_size: int, *, variance: float = 0.18) -> PacketDisguise:
        """Return a disguised packet size."""

        if packet_size <= 0:
            raise ValueError("packet_size must be positive")
        if variance < 0:
            raise ValueError("variance must be non-negative")

        jitter_bound = max(1, int(packet_size * variance))
        offset = self._random.randint(-jitter_bound, jitter_bound)
        cloaked = max(1, packet_size + offset)
        ratio = abs(cloaked - packet_size) / packet_size
        return PacketDisguise(
            original_size=packet_size,
            cloaked_size=cloaked,
            jitter_ratio=ratio,
        )

    def modulate_frequency(self, bursts: Iterable[int], *, spread: float = 0.25) -> List[float]:
        """Return normalized burst intervals that obscure frequency signatures."""

        values = list(bursts)
        if not values:
            return []
        if spread < 0:
            raise ValueError("spread must be non-negative")

        total = sum(values)
        normalized = []
        for value in values:
            base = value / total if total else 0
            jitter = self._random.uniform(-spread, spread)
            normalized.append(max(0.0, base + jitter))

        scale = sum(normalized) or 1.0
        return [value / scale for value in normalized]
