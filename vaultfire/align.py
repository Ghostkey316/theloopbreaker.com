"""Vector alignment helpers for routing purpose signals."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import ClassVar, Iterable, List, Mapping, MutableMapping, Optional, Sequence

__all__ = ["VectorSync"]


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _timestamp() -> str:
    return _utcnow().isoformat()


def _normalize_channels(channels: Iterable[str]) -> tuple[str, ...]:
    normalized: List[str] = []
    seen: set[str] = set()
    for channel in channels:
        label = str(channel).strip()
        if not label or label in seen:
            continue
        normalized.append(label)
        seen.add(label)
    if not normalized:
        raise ValueError("vector sync requires at least one channel")
    return tuple(normalized)


@dataclass
class VectorSync:
    """Coordinate routing targets across consciousness vectors."""

    target: str
    override: bool = False
    aligned_at: datetime = field(default_factory=_utcnow)
    _history: List[Mapping[str, object]] = field(default_factory=list, init=False, repr=False)

    _registry: ClassVar[List["VectorSync"]] = []

    def __post_init__(self) -> None:
        self.target = str(self.target).strip()
        if not self.target:
            raise ValueError("target cannot be empty")
        self.aligned_at = self.aligned_at.astimezone(timezone.utc)
        VectorSync._registry.append(self)

    @classmethod
    def align(
        cls,
        *,
        target: str,
        override: bool = False,
    ) -> "VectorSync":
        """Create a new alignment context for the provided target."""

        return cls(target=target, override=override)

    def push_to(
        self,
        channels: Iterable[str],
        *,
        weight: float | int = 1.0,
        metadata: Optional[Mapping[str, object]] = None,
    ) -> Mapping[str, object]:
        """Record a push event to the specified channels."""

        normalized_channels = _normalize_channels(channels)
        weight_value = float(weight)
        if weight_value <= 0:
            raise ValueError("weight must be positive")
        entry: MutableMapping[str, object] = {
            "channels": normalized_channels,
            "weight": weight_value,
            "override": bool(self.override),
            "pushed_at": _timestamp(),
        }
        if metadata:
            entry["metadata"] = {key: metadata[key] for key in metadata}
        self._history.append(entry)
        return dict(entry)

    @property
    def history(self) -> Sequence[Mapping[str, object]]:
        return tuple(dict(entry) for entry in self._history)

    @property
    def is_synced(self) -> bool:
        return bool(self._history)

    def snapshot(self) -> Mapping[str, object]:
        return {
            "target": self.target,
            "override": self.override,
            "aligned_at": self.aligned_at.isoformat(),
            "pushes": len(self._history),
            "active": self.is_synced,
        }

    @classmethod
    def registry(cls) -> Sequence["VectorSync"]:
        return tuple(cls._registry)

    @classmethod
    def clear_registry(cls) -> None:
        cls._registry.clear()

