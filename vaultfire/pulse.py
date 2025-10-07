"""Mission pulse monitoring utilities."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import ClassVar, Dict, Iterable, List, Mapping, MutableMapping, Optional, Sequence

__all__ = ["MissionMonitor"]


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _timestamp() -> str:
    return _utcnow().isoformat()


def _normalize_keys(keys: Iterable[str]) -> tuple[str, ...]:
    normalized: List[str] = []
    seen: set[str] = set()
    for raw in keys:
        label = str(raw).strip()
        if not label or label in seen:
            continue
        normalized.append(label)
        seen.add(label)
    if not normalized:
        raise ValueError("mission monitor requires at least one key value")
    return tuple(normalized)


def _coerce_percent(value: float | int | str) -> float:
    if isinstance(value, (int, float)):
        percent = float(value)
    else:
        stripped = str(value).strip()
        if not stripped:
            raise ValueError("threshold cannot be empty")
        if stripped.endswith("%"):
            stripped = stripped[:-1]
        percent = float(stripped) / 100.0 if "%" in str(value) else float(stripped)
    if percent <= 0:
        raise ValueError("threshold must be positive")
    if percent > 1:
        percent /= 100.0
    return percent


def _normalize_metrics(keys: Sequence[str], metrics: Mapping[str, object]) -> Dict[str, Optional[float]]:
    normalized: Dict[str, Optional[float]] = {}
    for key in keys:
        value = metrics.get(key)
        if value is None:
            normalized[key] = None
        elif isinstance(value, (int, float)):
            normalized[key] = float(value)
        else:
            raise TypeError(f"metric for '{key}' must be numeric or None")
    return normalized


@dataclass
class MissionMonitor:
    """Track mission metrics and evaluate alert thresholds."""

    keys: tuple[str, ...]
    created_at: datetime = field(default_factory=_utcnow)
    _history: List[Mapping[str, object]] = field(default_factory=list, init=False, repr=False)
    _alerts: Mapping[str, object] = field(default_factory=dict, init=False, repr=False)
    _baseline: Dict[str, Optional[float]] = field(default_factory=dict, init=False, repr=False)

    _registry: ClassVar[List["MissionMonitor"]] = []

    def __post_init__(self) -> None:
        self.keys = _normalize_keys(self.keys)
        self.created_at = self.created_at.astimezone(timezone.utc)
        MissionMonitor._registry.append(self)

    @classmethod
    def track(cls, *, key_values: Iterable[str]) -> "MissionMonitor":
        """Instantiate and register a monitor for the provided keys."""

        return cls(keys=_normalize_keys(key_values))

    def set_alerts(
        self,
        *,
        threshold_drop: float | int | str,
        notify: str,
    ) -> Mapping[str, object]:
        """Configure alert thresholds based on percentage drop."""

        handle = str(notify).strip()
        if not handle:
            raise ValueError("notify handle cannot be empty")
        threshold = _coerce_percent(threshold_drop)
        payload = {
            "threshold_drop": threshold,
            "notify": handle,
            "configured_at": _timestamp(),
        }
        self._alerts = payload
        return dict(payload)

    def record(
        self,
        metrics: Mapping[str, object],
        *,
        note: str | None = None,
    ) -> Mapping[str, object]:
        """Record a new measurement for the tracked keys."""

        normalized = _normalize_metrics(self.keys, metrics)
        if not self._baseline:
            self._baseline = dict(normalized)
        alert_triggered = False
        if self._alerts:
            threshold = float(self._alerts["threshold_drop"])
            for key, baseline_value in self._baseline.items():
                current = normalized.get(key)
                if baseline_value is None or current is None or baseline_value == 0:
                    continue
                drop = (baseline_value - current) / baseline_value
                if drop >= threshold:
                    alert_triggered = True
                    break
        entry: MutableMapping[str, object] = {
            "recorded_at": _timestamp(),
            "metrics": normalized,
            "note": note,
            "status": "alert" if alert_triggered else "ok",
        }
        if alert_triggered and self._alerts:
            entry["notify"] = self._alerts["notify"]
        self._history.append(entry)
        return dict(entry)

    @property
    def history(self) -> Sequence[Mapping[str, object]]:
        return tuple(dict(entry) for entry in self._history)

    @property
    def alerts(self) -> Mapping[str, object]:
        return dict(self._alerts)

    @property
    def baseline(self) -> Mapping[str, Optional[float]]:
        return dict(self._baseline)

    @property
    def is_healthy(self) -> bool:
        if not self._history:
            return True
        return self._history[-1]["status"] == "ok"

    def latest(self) -> Optional[Mapping[str, object]]:
        if not self._history:
            return None
        return dict(self._history[-1])

    def snapshot(self) -> Mapping[str, object]:
        latest = self.latest()
        return {
            "keys": self.keys,
            "created_at": self.created_at.isoformat(),
            "alerts": dict(self._alerts),
            "baseline": dict(self._baseline),
            "latest": latest,
            "status": latest["status"] if latest else "pending",
        }

    @classmethod
    def registry(cls) -> Sequence["MissionMonitor"]:
        return tuple(cls._registry)

    @classmethod
    def clear_registry(cls) -> None:
        cls._registry.clear()

