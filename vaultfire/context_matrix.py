"""Context matrix helpers for managing identity-driven state."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Iterable, Mapping, MutableMapping, Sequence

__all__ = [
    "ContextNode",
    "LinkSpanner",
    "BeliefAnchor",
    "RecallBridge",
]


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _timestamp() -> str:
    return _utcnow().isoformat()


def _normalize_terms(values: Iterable[str] | None) -> tuple[str, ...]:
    normalized: list[str] = []
    seen: set[str] = set()
    for raw in values or ():
        text = str(raw).strip()
        if not text or text in seen:
            continue
        normalized.append(text)
        seen.add(text)
    return tuple(normalized)


def _coerce_label(value: str, *, field_name: str) -> str:
    text = str(value).strip()
    if not text:
        raise ValueError(f"{field_name} cannot be empty")
    return text


def _coerce_positive_ratio(value: float | int | str, *, field_name: str) -> float:
    if isinstance(value, bool):
        raise TypeError(f"{field_name} must be numeric")
    if isinstance(value, (int, float)):
        ratio = float(value)
    else:
        stripped = str(value).strip()
        if not stripped:
            raise ValueError(f"{field_name} cannot be empty")
        if stripped.endswith("%"):
            stripped = stripped[:-1]
            ratio = float(stripped) / 100.0
        else:
            ratio = float(stripped)
    if ratio < 0:
        raise ValueError(f"{field_name} must be greater than or equal to zero")
    if ratio > 1:
        ratio /= 100.0
    return ratio


@dataclass
class ContextNode:
    """Represent a persistent identity context for a user."""

    identity: str
    scope: str = "session"
    priority: Sequence[str] = field(default_factory=tuple)
    created_at: datetime = field(default_factory=_utcnow, init=False)
    _events: list[Mapping[str, object]] = field(default_factory=list, init=False, repr=False)

    def __post_init__(self) -> None:
        self.identity = _coerce_label(self.identity, field_name="identity")
        self.scope = _coerce_label(self.scope, field_name="scope")
        self.priority = _normalize_terms(self.priority)
        self.created_at = self.created_at.astimezone(timezone.utc)

    def record_event(
        self,
        description: str,
        *,
        tags: Iterable[str] | None = None,
        signal: Mapping[str, object] | None = None,
    ) -> Mapping[str, object]:
        """Record a contextual event associated with the node."""

        detail = _coerce_label(description, field_name="description")
        normalized_tags = _normalize_terms(tags)
        payload: MutableMapping[str, object] = {
            "timestamp": _timestamp(),
            "description": detail,
            "tags": normalized_tags,
        }
        if signal:
            payload["signal"] = dict(signal)
        self._events.append(dict(payload))
        return dict(payload)

    def update_priority(self, values: Iterable[str]) -> tuple[str, ...]:
        """Replace the priority sequence for the node."""

        self.priority = _normalize_terms(values)
        return tuple(self.priority)

    @property
    def events(self) -> Sequence[Mapping[str, object]]:
        return tuple(dict(event) for event in self._events)

    @property
    def snapshot(self) -> Mapping[str, object]:
        return {
            "identity": self.identity,
            "scope": self.scope,
            "priority": tuple(self.priority),
            "created_at": self.created_at.isoformat(),
        }


@dataclass
class BeliefAnchor:
    """Bind belief statements to a manifest log."""

    log: str
    mode: str = "observed"
    created_at: datetime = field(default_factory=_utcnow, init=False)
    _entries: list[Mapping[str, object]] = field(default_factory=list, init=False, repr=False)

    def __post_init__(self) -> None:
        self.log = _coerce_label(self.log, field_name="log")
        self.mode = _coerce_label(self.mode, field_name="mode").lower()
        self.created_at = self.created_at.astimezone(timezone.utc)

    def bind(
        self,
        statement: str,
        *,
        weight: float | int | str = 1.0,
        tags: Iterable[str] | None = None,
    ) -> Mapping[str, object]:
        """Attach a belief statement to the anchor."""

        detail = _coerce_label(statement, field_name="statement")
        confidence = _coerce_positive_ratio(weight, field_name="weight")
        normalized_tags = _normalize_terms(tags)
        entry: MutableMapping[str, object] = {
            "logged_at": _timestamp(),
            "statement": detail,
            "confidence": confidence,
            "tags": normalized_tags,
        }
        self._entries.append(dict(entry))
        return dict(entry)

    def reinforce(self) -> str:
        """Mark the anchor as reinforced."""

        self.mode = "reinforced"
        return self.mode

    @property
    def entries(self) -> Sequence[Mapping[str, object]]:
        return tuple(dict(entry) for entry in self._entries)

    @property
    def summary(self) -> Mapping[str, object]:
        return {
            "log": self.log,
            "mode": self.mode,
            "entries": len(self._entries),
        }


@dataclass
class LinkSpanner:
    """Span contextual links across time windows."""

    window: str
    relevance_threshold: float = 0.5
    _links: list[Mapping[str, object]] = field(default_factory=list, init=False, repr=False)

    def __post_init__(self) -> None:
        self.window = _coerce_label(self.window, field_name="window")
        threshold = _coerce_positive_ratio(self.relevance_threshold, field_name="relevance_threshold")
        if threshold <= 0:
            raise ValueError("relevance_threshold must be greater than zero")
        if threshold > 1:
            raise ValueError("relevance_threshold must be between 0 and 1")
        self.relevance_threshold = threshold

    def link(
        self,
        context: ContextNode,
        anchor: BeliefAnchor,
        *,
        confidence: float | int | str,
        note: str | None = None,
    ) -> Mapping[str, object]:
        """Create a link between a context node and an anchor."""

        score = _coerce_positive_ratio(confidence, field_name="confidence")
        if score > 1:
            raise ValueError("confidence must be between 0 and 1")
        status = "linked" if score >= self.relevance_threshold else "deferred"
        entry: MutableMapping[str, object] = {
            "linked_at": _timestamp(),
            "window": self.window,
            "confidence": score,
            "status": status,
            "context": context.snapshot,
            "anchor": anchor.summary,
        }
        if note:
            entry["note"] = note
        self._links.append(dict(entry))
        return dict(entry)

    @property
    def links(self) -> Sequence[Mapping[str, object]]:
        return tuple(dict(link) for link in self._links)


@dataclass
class RecallBridge:
    """Dispatch contextual recall events based on triggers."""

    trigger_mode: str
    fallback: str
    _status: str = field(default="LIVE", init=False, repr=False)
    _history: list[Mapping[str, object]] = field(default_factory=list, init=False, repr=False)

    def __post_init__(self) -> None:
        self.trigger_mode = _coerce_label(self.trigger_mode, field_name="trigger_mode")
        self.fallback = _coerce_label(self.fallback, field_name="fallback")

    @property
    def status(self) -> str:
        return self._status

    def dispatch(self, signal: str, *, context: Mapping[str, object]) -> Mapping[str, object]:
        """Dispatch a recall request for the provided signal."""

        route = _coerce_label(signal, field_name="signal")
        payload: MutableMapping[str, object] = {
            "dispatched_at": _timestamp(),
            "route": route,
            "trigger_mode": self.trigger_mode,
            "status": self._status,
            "context": dict(context),
        }
        self._history.append(dict(payload))
        return dict(payload)

    def suspend(self) -> str:
        """Temporarily suspend recall dispatching."""

        self._status = "PAUSED"
        return self._status

    def resume(self) -> str:
        """Resume recall dispatching."""

        self._status = "LIVE"
        return self._status

    def close(self) -> str:
        """Close the bridge and mark it as offline."""

        self._status = "CLOSED"
        return self._status

    @property
    def history(self) -> Sequence[Mapping[str, object]]:
        return tuple(dict(entry) for entry in self._history)

    @property
    def last_dispatch(self) -> Mapping[str, object] | None:
        if not self._history:
            return None
        return dict(self._history[-1])
