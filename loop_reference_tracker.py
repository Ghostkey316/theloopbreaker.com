"""Track and persist references to Vaultfire loop terminology."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable

# Keywords that should trigger loop reference tracking. The list is sourced
# from the Architect's EP2 activation goals and is intentionally kept in a
# single place so future episodes can extend it without touching call sites.
KEYWORDS: tuple[str, ...] = (
    "reset",
    "loop",
    "belief protocol",
    "architect",
    "ep1",
    "ghostkey",
    "codex",
    "endless protocol",
    "vaultfire",
    "ghost manifesto",
    "proof-of-loop",
)

LOG_PATH = Path("loop_reference_log.json")


def _load_log() -> list[dict[str, Any]]:
    if LOG_PATH.exists():
        try:
            return json.loads(LOG_PATH.read_text())
        except json.JSONDecodeError:
            return []
    return []


def _write_log(entries: list[dict[str, Any]]) -> None:
    LOG_PATH.write_text(json.dumps(entries, indent=2))


def _iter_strings(value: Any) -> Iterable[str]:
    """Yield all string fragments contained in the provided value."""

    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for nested in value.values():
            yield from _iter_strings(nested)
    elif isinstance(value, (list, tuple, set)):
        for nested in value:
            yield from _iter_strings(nested)


def _find_matches(text: str) -> set[str]:
    lowered = text.lower()
    return {keyword for keyword in KEYWORDS if keyword in lowered}


def record_reference(text: str, *, source: str | None = None, metadata: Any = None) -> set[str]:
    """Record direct references to loop keywords contained in text."""

    matches = _find_matches(text)
    if not matches:
        return set()

    entries = _load_log()
    entry: dict[str, Any] = {
        "timestamp": datetime.utcnow().isoformat(),
        "source": source or "direct",
        "matches": sorted(matches),
        "excerpt": text,
    }
    if metadata is not None:
        entry["metadata"] = metadata
    entries.append(entry)
    _write_log(entries)
    return matches


def record_reference_from_event(event: str, meta: Any = None) -> set[str]:
    """Check an event and its metadata for tracked loop references."""

    combined_matches: set[str] = set()
    for fragment in _iter_strings(event):
        combined_matches.update(_find_matches(fragment))
    for fragment in _iter_strings(meta):
        combined_matches.update(_find_matches(fragment))

    if not combined_matches:
        return set()

    entries = _load_log()
    entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "source": "signal_event",
        "matches": sorted(combined_matches),
        "event": event,
    }
    if meta:
        entry["meta"] = meta
    entries.append(entry)
    _write_log(entries)
    return combined_matches


__all__ = [
    "KEYWORDS",
    "LOG_PATH",
    "record_reference",
    "record_reference_from_event",
]

