"""Protocol Unique: time-indexed signal echo utilities for Ghostkey."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, Iterator, List, Mapping, MutableMapping, Tuple

MODULE_TAG = "Protocol Unique"


@dataclass(frozen=True)
class SignalEchoFrame:
    """Immutable representation of a recorded signal echo frame."""

    interaction_id: str
    timestamp: datetime
    emotion: str
    ethic: str
    intensity: float
    tags: Tuple[str, ...] = field(default_factory=tuple)
    metadata: Mapping[str, object] = field(default_factory=dict)

    def resolve_weight(self) -> float:
        """Derive a normalized weight for the frame."""

        base = max(min(float(self.intensity), 1.0), 0.0)
        ethic_key = self.ethic.strip().lower()
        if ethic_key in {"aligned", "support", "reinforce"}:
            base += 0.2
        elif ethic_key in {"drift", "warning", "caution"}:
            base -= 0.15
        elif ethic_key in {"breach", "critical", "override"}:
            base -= 0.35
        return max(min(base, 1.0), -1.0)

    def to_payload(self) -> Dict[str, object]:
        """Return a JSON serializable payload for persistence."""

        return {
            "interaction_id": self.interaction_id,
            "timestamp": self.timestamp.isoformat(),
            "emotion": self.emotion,
            "ethic": self.ethic,
            "intensity": self.intensity,
            "tags": list(self.tags),
            "metadata": dict(self.metadata),
        }


class SignalEchoEngine:
    """Stores and replays signal echo frames for Ghostkey interactions."""

    INDEX_ENV = "VAULTFIRE_SIGNAL_ECHO_INDEX_PATH"

    def __init__(self) -> None:
        self._frames: List[SignalEchoFrame] = []
        self._by_interaction: MutableMapping[str, List[SignalEchoFrame]] = {}
        self._by_tag: MutableMapping[str, List[SignalEchoFrame]] = {}

    @staticmethod
    def _normalize_tags(tags: Iterable[str]) -> Tuple[str, ...]:
        normalized = sorted({tag.strip().lower() for tag in tags if tag})
        return tuple(normalized)

    @staticmethod
    def _coerce_timestamp(timestamp: datetime | None) -> datetime:
        if timestamp is None:
            return datetime.now(timezone.utc)
        if timestamp.tzinfo is None:
            return timestamp.replace(tzinfo=timezone.utc)
        return timestamp.astimezone(timezone.utc)

    def record_frame(
        self,
        interaction_id: str,
        *,
        emotion: str,
        ethic: str,
        intensity: float,
        tags: Iterable[str] = (),
        metadata: Mapping[str, object] | None = None,
        timestamp: datetime | None = None,
    ) -> SignalEchoFrame:
        """Persist a new echo frame and update indexes."""

        frame = SignalEchoFrame(
            interaction_id=interaction_id,
            timestamp=self._coerce_timestamp(timestamp),
            emotion=str(emotion),
            ethic=str(ethic),
            intensity=float(intensity),
            tags=self._normalize_tags(tags),
            metadata=dict(metadata or {}),
        )
        self._frames.append(frame)
        self._by_interaction.setdefault(interaction_id, []).append(frame)
        for tag in frame.tags:
            self._by_tag.setdefault(tag, []).append(frame)
        self._frames.sort(key=lambda item: item.timestamp)
        for frames in self._by_interaction.values():
            frames.sort(key=lambda item: item.timestamp)
        for frames in self._by_tag.values():
            frames.sort(key=lambda item: item.timestamp)
        return frame

    def frames(self, interaction_id: str | None = None) -> List[SignalEchoFrame]:
        """Return ordered frames for an interaction or the full set."""

        if interaction_id is None:
            return list(self._frames)
        return list(self._by_interaction.get(interaction_id, ()))

    def replay(self, interaction_id: str, *, limit: int | None = None) -> List[SignalEchoFrame]:
        """Replay frames for a specific interaction."""

        frames = self.frames(interaction_id)
        if limit is not None and limit >= 0:
            return frames[-limit:]
        return frames

    def window(self, *, start: datetime | None = None, end: datetime | None = None) -> List[SignalEchoFrame]:
        """Return frames within a time range."""

        start_ts = self._coerce_timestamp(start) if start else None
        end_ts = self._coerce_timestamp(end) if end else None
        results = []
        for frame in self._frames:
            if start_ts and frame.timestamp < start_ts:
                continue
            if end_ts and frame.timestamp > end_ts:
                continue
            results.append(frame)
        return results

    def tag_index(self, tag: str) -> List[SignalEchoFrame]:
        """Return frames associated with a tag."""

        return list(self._by_tag.get(tag.strip().lower(), ()))

    def ethic_history(self, interaction_id: str | None = None, *, limit: int | None = None) -> List[str]:
        """Return the ethic labels for recorded frames."""

        frames = self.frames(interaction_id)
        if limit is not None and limit >= 0:
            frames = frames[-limit:]
        return [frame.ethic for frame in frames]

    def signal_weight(self, interaction_id: str | None = None) -> float:
        """Aggregate the normalized signal weight for the provided scope."""

        frames = self.frames(interaction_id)
        if not frames:
            return 0.0
        total = sum(frame.resolve_weight() for frame in frames)
        normalized = total / len(frames)
        return max(min(normalized, 1.0), -1.0)

    def export_index(self) -> List[Dict[str, object]]:
        """Export a serializable snapshot of the recorded frames."""

        return [frame.to_payload() for frame in self._frames]

    def save(self, path: str | os.PathLike[str] | None = None) -> Path:
        """Persist the current index to disk."""

        target = Path(path) if path is not None else self.default_path()
        target.parent.mkdir(parents=True, exist_ok=True)
        payload = json.dumps(self.export_index(), indent=2)
        target.write_text(payload + "\n")
        return target

    @classmethod
    def from_index(cls, frames: Iterable[Mapping[str, object]]) -> "SignalEchoEngine":
        """Rehydrate an engine from serialized frames."""

        engine = cls()
        for item in frames:
            timestamp_raw = item.get("timestamp")
            timestamp = None
            if isinstance(timestamp_raw, str):
                timestamp = datetime.fromisoformat(timestamp_raw)
            engine.record_frame(
                str(item.get("interaction_id", "")),
                emotion=str(item.get("emotion", "")),
                ethic=str(item.get("ethic", "")),
                intensity=float(item.get("intensity", 0.0)),
                tags=item.get("tags", ()),
                metadata=item.get("metadata", {}),
                timestamp=timestamp,
            )
        return engine

    @classmethod
    def load(cls, path: str | os.PathLike[str] | None = None) -> "SignalEchoEngine":
        """Load a saved index from disk."""

        target = Path(path) if path is not None else cls.default_path()
        if not target.exists():
            return cls()
        try:
            data = json.loads(target.read_text())
        except json.JSONDecodeError:
            return cls()
        if isinstance(data, list):
            return cls.from_index(data)
        return cls()

    @classmethod
    def default_path(cls) -> Path:
        """Return the default path used for persistence."""

        custom = os.getenv(cls.INDEX_ENV)
        if custom:
            return Path(custom)
        return Path("status") / "signal_echo_index.json"

    def __iter__(self) -> Iterator[SignalEchoFrame]:
        return iter(self._frames)
