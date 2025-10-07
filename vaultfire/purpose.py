"""Purpose alignment primitives for managing EchoPath loops."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
import re
from typing import ClassVar, Iterable, List, Mapping, MutableMapping, Optional, Sequence

__all__ = ["EchoPath"]


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _format_window(delta: timedelta) -> str:
    total_seconds = int(delta.total_seconds())
    if total_seconds <= 0:
        raise ValueError("window duration must be positive")
    weeks, remaining = divmod(total_seconds, 7 * 24 * 60 * 60)
    days, remaining = divmod(remaining, 24 * 60 * 60)
    hours, remaining = divmod(remaining, 60 * 60)
    minutes, seconds = divmod(remaining, 60)
    parts: List[str] = []
    if weeks:
        parts.append(f"{weeks}w")
    if days:
        parts.append(f"{days}d")
    if hours:
        parts.append(f"{hours}h")
    if minutes:
        parts.append(f"{minutes}m")
    if seconds or not parts:
        parts.append(f"{seconds}s")
    return "".join(parts)


_WINDOW_PATTERN = re.compile(r"^(?P<value>\d+(?:\.\d+)?)(?P<unit>[smhdw])$")


def _parse_window(value: str | int | float | timedelta) -> tuple[timedelta, str]:
    if isinstance(value, timedelta):
        delta = value
        spec = _format_window(delta)
    elif isinstance(value, (int, float)):
        if value <= 0:
            raise ValueError("window duration must be positive")
        delta = timedelta(days=float(value))
        spec = _format_window(delta)
    elif isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            raise ValueError("window specification cannot be empty")
        match = _WINDOW_PATTERN.fullmatch(stripped)
        if not match:
            raise ValueError(
                "window specification must use <value><unit> format (s/m/h/d/w)"
            )
        number = float(match.group("value"))
        unit = match.group("unit")
        if number <= 0:
            raise ValueError("window duration must be positive")
        multiplier: Mapping[str, float] = {
            "s": 1,
            "m": 60,
            "h": 60 * 60,
            "d": 24 * 60 * 60,
            "w": 7 * 24 * 60 * 60,
        }
        seconds = number * multiplier[unit]
        delta = timedelta(seconds=seconds)
        spec = stripped
    else:
        raise TypeError("window must be a timedelta, number of days, or duration string")
    if delta <= timedelta(0):
        raise ValueError("window duration must be positive")
    return delta, spec


def _normalize_tags(tags: Optional[Iterable[str]]) -> tuple[str, ...]:
    if not tags:
        return ()
    normalized: List[str] = []
    for tag in tags:
        normalized.append(str(tag).strip())
    return tuple(tag for tag in normalized if tag)


@dataclass
class EchoPath:
    """Container maintaining loyalty-aware purpose reinforcement loops."""

    source: str
    signal: str
    window: timedelta
    window_spec: str = ""
    created_at: datetime = field(default_factory=_utcnow)
    _loyalty_feed: List[Mapping[str, object]] = field(default_factory=list, init=False, repr=False)
    _last_signal_at: Optional[str] = field(default=None, init=False, repr=False)

    _registry: ClassVar[List["EchoPath"]] = []

    def __post_init__(self) -> None:
        self.source = self._validate_label("source", self.source)
        self.signal = self._validate_label("signal", self.signal)
        if not isinstance(self.window, timedelta):
            raise TypeError("window must be a timedelta instance")
        if self.window <= timedelta(0):
            raise ValueError("window duration must be positive")
        if not self.window_spec:
            self.window_spec = _format_window(self.window)
        self.created_at = self.created_at.astimezone(timezone.utc)
        EchoPath._registry.append(self)

    @classmethod
    def initiate(
        cls,
        *,
        source: str,
        signal: str,
        window: str | int | float | timedelta,
    ) -> "EchoPath":
        """Create and register a new EchoPath window."""

        delta, spec = _parse_window(window)
        return cls(source=source, signal=signal, window=delta, window_spec=spec)

    @staticmethod
    def _validate_label(field_name: str, value: str) -> str:
        normalized = str(value).strip()
        if not normalized:
            raise ValueError(f"{field_name} cannot be empty")
        return normalized

    @property
    def loyalty_signals(self) -> Sequence[Mapping[str, object]]:
        return tuple(dict(entry) for entry in self._loyalty_feed)

    @property
    def loyalty_signal_count(self) -> int:
        return len(self._loyalty_feed)

    @property
    def last_signal_at(self) -> Optional[str]:
        return self._last_signal_at

    @property
    def window_end(self) -> datetime:
        return self.created_at + self.window

    def window_remaining(self, *, at: Optional[datetime] = None) -> float:
        point = (at or _utcnow()).astimezone(timezone.utc)
        remaining = self.window_end - point
        return max(remaining.total_seconds(), 0.0)

    @property
    def is_active(self) -> bool:
        return self.window_remaining() > 0

    def feed_loyalty_signals(
        self,
        *,
        wallet: str,
        multiplier: str | int | float,
        timestamp: Optional[datetime] = None,
        tags: Optional[Iterable[str]] = None,
    ) -> Mapping[str, object]:
        """Record a loyalty reinforcement event for the path."""

        wallet_id = self._validate_label("wallet", wallet)
        if isinstance(multiplier, (int, float)):
            if multiplier <= 0:
                raise ValueError("multiplier must be positive")
            multiplier_value: object = float(multiplier)
        else:
            normalized_multiplier = str(multiplier).strip()
            if not normalized_multiplier:
                raise ValueError("multiplier cannot be empty")
            multiplier_value = normalized_multiplier
        recorded_at = (timestamp or _utcnow()).astimezone(timezone.utc).isoformat()
        entry: MutableMapping[str, object] = {
            "wallet": wallet_id,
            "multiplier": multiplier_value,
            "recorded_at": recorded_at,
            "tags": _normalize_tags(tags),
        }
        self._loyalty_feed.append(entry)
        self._last_signal_at = recorded_at
        return dict(entry)

    def snapshot(self) -> Mapping[str, object]:
        return {
            "source": self.source,
            "signal": self.signal,
            "window": self.window_spec,
            "created_at": self.created_at.isoformat(),
            "window_end": self.window_end.isoformat(),
            "remaining_seconds": self.window_remaining(),
            "active": self.is_active,
            "loyalty_events": self.loyalty_signal_count,
        }

    @classmethod
    def registry(cls) -> Sequence["EchoPath"]:
        return tuple(cls._registry)

    @classmethod
    def clear_registry(cls) -> None:
        cls._registry.clear()

