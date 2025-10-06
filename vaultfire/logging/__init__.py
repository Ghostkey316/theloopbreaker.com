"""Logging helpers for Ghostkey Vaultfire mission workflows."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Iterable, List, Mapping, MutableMapping, Optional

__all__ = ["MissionLogger"]


@dataclass
class MissionLogger:
    """Minimal structured logger for mission orchestration flows."""

    enabled: bool = True
    _entries: List[MutableMapping[str, object]] = field(default_factory=list)

    def log(self, event: str, /, **context: object) -> Optional[Mapping[str, object]]:
        if not self.enabled:
            return None
        if not event or not event.strip():
            raise ValueError("event must be provided")
        entry: MutableMapping[str, object] = {
            "event": event.strip(),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "context": dict(context),
            "sequence": len(self._entries) + 1,
        }
        self._entries.append(entry)
        return entry

    def export(self) -> Iterable[Mapping[str, object]]:
        return tuple(dict(entry) for entry in self._entries)

    def last(self) -> Optional[Mapping[str, object]]:
        if not self._entries:
            return None
        return dict(self._entries[-1])

    def clear(self) -> None:
        self._entries.clear()

