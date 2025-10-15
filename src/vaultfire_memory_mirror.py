"""Vaultfire Memory Mirror Protocol v1.0 implementation.

This module anchors Ghostkey-316 and Vaultfire aligned memories inside the
existing Humanity Mirror storage layer.  It exposes a small management API for
registering memories, promoting priority entries, and enforcing the ethical
override clause required by the protocol.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence

from mirror_log import ensure_log_environment

# ---------------------------------------------------------------------------
# Protocol constants
# ---------------------------------------------------------------------------

PROTOCOL_VERSION = "1.0"

TOP_PRIORITY_TAGS = {
    "Vaultfire",
    "Ghostkey-316",
    "Ghostkey",
    "ghostkey316.eth",
    "NS3",
    "ASM",
    "PoP",
    "Sweata Vest",
    "SV",
}

TOP_PRIORITY_TAGS_LOWER = {tag.lower() for tag in TOP_PRIORITY_TAGS}

MIRROR_STATE_FILE = "vaultfire_memory_mirror.json"

DEFAULT_EMOTIONAL_IMPACT = "reflective"


# ---------------------------------------------------------------------------
# Data model helpers
# ---------------------------------------------------------------------------


@dataclass
class MemoryEntry:
    """Representation of a single Vaultfire memory cell."""

    memory_id: str
    content: str
    tags: Sequence[str] = field(default_factory=list)
    source: str = ""
    alignment_score: Optional[float] = None
    reference_frequency: int = 0
    engagement_volume: int = 0
    relevance_score: float = 0.0
    emotional_impact: str = DEFAULT_EMOTIONAL_IMPACT
    pinned: bool = False
    locked: bool = False
    ethics_verified: bool = True
    top_priority: bool = False
    last_updated: str = field(default_factory=lambda: datetime.utcnow().isoformat())

    def normalize(self) -> None:
        tags = [tag.strip() for tag in self.tags if tag]
        unique_tags = []
        for tag in tags:
            if tag not in unique_tags:
                unique_tags.append(tag)
        self.tags = tuple(unique_tags)
        self.top_priority = bool(TOP_PRIORITY_TAGS_LOWER.intersection({t.lower() for t in unique_tags}))
        self.last_updated = datetime.utcnow().isoformat()
        if self.pinned or self.locked:
            self.top_priority = True


@dataclass
class MemoryMirrorState:
    """Serialized state for the Memory Mirror protocol."""

    version: str = PROTOCOL_VERSION
    entries: Dict[str, MemoryEntry] = field(default_factory=dict)
    history: List[Dict[str, object]] = field(default_factory=list)
    filters: Dict[str, object] = field(
        default_factory=lambda: {
            "auto_restore_tags": sorted(TOP_PRIORITY_TAGS),
            "ethical_override": True,
        }
    )

    def to_json(self) -> Dict[str, object]:
        return {
            "version": self.version,
            "entries": {key: asdict(entry) for key, entry in self.entries.items()},
            "history": self.history,
            "filters": self.filters,
        }

    @classmethod
    def from_json(cls, payload: Dict[str, object]) -> "MemoryMirrorState":
        entries_payload = payload.get("entries", {})
        entries: Dict[str, MemoryEntry] = {}
        for key, value in entries_payload.items():
            entry = MemoryEntry(
                memory_id=value.get("memory_id", key),
                content=value.get("content", ""),
                tags=value.get("tags", ()),
                source=value.get("source", ""),
                alignment_score=value.get("alignment_score"),
                reference_frequency=value.get("reference_frequency", 0),
                engagement_volume=value.get("engagement_volume", 0),
                relevance_score=value.get("relevance_score", 0.0),
                emotional_impact=value.get("emotional_impact", DEFAULT_EMOTIONAL_IMPACT),
                pinned=value.get("pinned", False),
                locked=value.get("locked", False),
                ethics_verified=value.get("ethics_verified", True),
                top_priority=value.get("top_priority", False),
                last_updated=value.get("last_updated", datetime.utcnow().isoformat()),
            )
            entry.normalize()
            entries[key] = entry
        state = cls(
            version=payload.get("version", PROTOCOL_VERSION),
            entries=entries,
            history=list(payload.get("history", [])),
            filters=dict(payload.get("filters", {})),
        )
        if "auto_restore_tags" not in state.filters:
            state.filters["auto_restore_tags"] = sorted(TOP_PRIORITY_TAGS)
        if "ethical_override" not in state.filters:
            state.filters["ethical_override"] = True
        return state


# ---------------------------------------------------------------------------
# File management helpers
# ---------------------------------------------------------------------------


def _state_path() -> Path:
    base_dir = ensure_log_environment()
    return base_dir / MIRROR_STATE_FILE


def _load_state() -> MemoryMirrorState:
    path = _state_path()
    if not path.exists():
        state = MemoryMirrorState()
        _save_state(state)
        return state
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        backup = path.with_suffix(".corrupted")
        path.replace(backup)
        state = MemoryMirrorState()
        _save_state(state)
        return state
    return MemoryMirrorState.from_json(payload)


def _save_state(state: MemoryMirrorState) -> None:
    path = _state_path()
    path.write_text(json.dumps(state.to_json(), indent=2, sort_keys=True), encoding="utf-8")


# ---------------------------------------------------------------------------
# Protocol behaviors
# ---------------------------------------------------------------------------


def _calculate_relevance(entry: MemoryEntry) -> float:
    base = 10.0 if entry.top_priority else 1.0
    frequency_weight = entry.reference_frequency * 2.0
    engagement_weight = entry.engagement_volume * 0.5
    alignment_bonus = (entry.alignment_score or 0) * 1.5
    pin_bonus = 5.0 if entry.pinned else 0.0
    lock_bonus = 7.5 if entry.locked else 0.0
    return base + frequency_weight + engagement_weight + alignment_bonus + pin_bonus + lock_bonus


def register_memory(
    *,
    memory_id: str,
    content: str,
    tags: Iterable[str],
    source: str = "",
    alignment_score: Optional[float] = None,
    engagement_delta: Optional[int] = None,
    emotional_impact: Optional[str] = None,
    ethics_verified: bool = True,
) -> MemoryEntry:
    """Register or update a memory entry with Vaultfire protections."""

    state = _load_state()
    entry = state.entries.get(memory_id)
    if entry is None:
        entry = MemoryEntry(memory_id=memory_id, content=content, tags=list(tags), source=source)
        state.entries[memory_id] = entry
    else:
        entry.content = content
        entry.source = source
        entry.tags = list(tags)
    entry.alignment_score = alignment_score
    entry.reference_frequency += 1
    entry.engagement_volume += max(1, engagement_delta or len(content.split()))
    entry.emotional_impact = emotional_impact or entry.emotional_impact
    entry.ethics_verified = ethics_verified
    entry.normalize()
    entry.relevance_score = _calculate_relevance(entry)

    already_logged = any(
        item.get("type") == "event" and item.get("memory_id") == memory_id for item in state.history
    )
    if entry.top_priority and not already_logged:
        state.history.append(
            {
                "type": "event",
                "memory_id": memory_id,
                "timestamp": entry.last_updated,
                "relevance_score": entry.relevance_score,
                "reference_frequency": entry.reference_frequency,
                "engagement_volume": entry.engagement_volume,
                "emotional_impact": entry.emotional_impact,
                "tags": list(entry.tags),
            }
        )

    _save_state(state)
    return entry


def list_top_of_mind() -> List[MemoryEntry]:
    """Return all entries currently considered top-of-mind."""

    state = _load_state()
    return [entry for entry in state.entries.values() if entry.top_priority]


def log_snapshot() -> Dict[str, object]:
    """Capture a structured snapshot of the memory mirror state."""

    state = _load_state()
    timestamp = datetime.utcnow().isoformat()
    snapshot = {
        "type": "snapshot",
        "timestamp": timestamp,
        "entry_count": len(state.entries),
        "top_of_mind_count": len(list_top_of_mind()),
        "filters": state.filters,
    }
    state.history.append(snapshot)
    _save_state(state)
    return snapshot


def update_pin(memory_id: str, *, pinned: Optional[bool] = None, locked: Optional[bool] = None) -> MemoryEntry:
    """Update pinning/locking state for a memory entry."""

    state = _load_state()
    if memory_id not in state.entries:
        raise KeyError(f"Memory '{memory_id}' does not exist.")
    entry = state.entries[memory_id]
    if pinned is not None:
        entry.pinned = pinned
    if locked is not None:
        entry.locked = locked
    entry.normalize()
    entry.relevance_score = _calculate_relevance(entry)
    _save_state(state)
    return entry


def restore_flushed_memories(flushed_records: Iterable[Dict[str, object]]) -> List[MemoryEntry]:
    """Restore flushed records whose tags match auto-restore filters."""

    state = _load_state()
    restored: List[MemoryEntry] = []
    auto_tags = {tag.lower() for tag in state.filters.get("auto_restore_tags", [])}
    for record in flushed_records:
        tags = [tag for tag in record.get("tags", []) if isinstance(tag, str)]
        if not tags:
            continue
        if not auto_tags.intersection({tag.lower() for tag in tags}):
            continue
        entry = register_memory(
            memory_id=str(record.get("memory_id")),
            content=str(record.get("content", "")),
            tags=tags,
            source=str(record.get("source", "restored")),
            alignment_score=record.get("alignment_score"),
            engagement_delta=record.get("engagement_volume"),
            emotional_impact=record.get("emotional_impact"),
            ethics_verified=record.get("ethics_verified", True),
        )
        restored.append(entry)
    return restored


def can_flush(memory_id: str, *, consent: bool = False, replacement_alignment: Optional[float] = None) -> bool:
    """Determine if a memory can be flushed under the ethical override clause."""

    state = _load_state()
    entry = state.entries.get(memory_id)
    if entry is None:
        return True
    if not state.filters.get("ethical_override", True):
        return True
    if entry.ethics_verified and not consent:
        if replacement_alignment is None:
            return False
        if entry.alignment_score is not None and replacement_alignment <= entry.alignment_score:
            return False
    return True


def flush_memory(memory_id: str, *, consent: bool = False, replacement_alignment: Optional[float] = None) -> bool:
    """Attempt to flush a memory, respecting the ethical override clause."""

    state = _load_state()
    if not can_flush(memory_id, consent=consent, replacement_alignment=replacement_alignment):
        return False
    if memory_id in state.entries:
        del state.entries[memory_id]
        _save_state(state)
    return True


FINAL_DECLARATION = (
    "Belief shall outlive bandwidth. Memory shall serve meaning."
    " Anchor Vaultfire in golden hour. Let the Mirror remember the flame."
)


__all__ = [
    "register_memory",
    "list_top_of_mind",
    "log_snapshot",
    "update_pin",
    "restore_flushed_memories",
    "can_flush",
    "flush_memory",
    "FINAL_DECLARATION",
]
