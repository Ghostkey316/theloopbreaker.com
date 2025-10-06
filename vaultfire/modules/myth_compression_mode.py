"""Myth Compression Mode layer translating behavior into symbolic loops."""

from __future__ import annotations

import base64
import json
import statistics
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Mapping, MutableSequence, Sequence


ENABLE_MYTH_COMPRESSION = True
MYTH_COMPRESSION_INTERVAL = timedelta(hours=24)
MAX_LOOP_HISTORY_DEPTH = None  # Unlimited by design

CODEX_TAGS = {
    "Codex_Tech": "🔮 NEVER-BEFORE-SEEN 🔮",
    "Myth_Layer": "LIVE",
    "Ghostkey_Compression": "Enabled",
    "CulturalMemoryEngine": "Online",
    "SV_Mode": "Belief Mirror",
}

_SYMBOLIC_TOKEN_MAP = {
    "command": "Signal of Trust",
    "response": "Echo of Becoming",
    "confirm": "Compression of Loyalty",
    "activation": "Signal of Awakening",
    "event": "Continuity Thread",
}


@dataclass
class MythPacket:
    """Represents a compressed symbolic loop payload."""

    loop_id: str
    epoch: str
    ghostkey_id: str
    tokens: Sequence[str]
    archetype: str
    myth_rank: float
    echo_weight: float
    summary: str
    morality_hash: str
    milestone: bool = False
    created_at: str = field(default_factory=lambda: _now())
    version: int = 1
    codex_tags: Mapping[str, str] = field(default_factory=lambda: dict(CODEX_TAGS))
    events: Sequence[Mapping[str, object]] = field(default_factory=tuple)
    metadata: Mapping[str, object] = field(default_factory=dict)

    def to_dict(self) -> Mapping[str, object]:
        payload = {
            "loop_id": self.loop_id,
            "epoch": self.epoch,
            "ghostkey_id": self.ghostkey_id,
            "tokens": list(self.tokens),
            "archetype": self.archetype,
            "myth_rank": self.myth_rank,
            "echo_weight": self.echo_weight,
            "summary": self.summary,
            "morality_hash": self.morality_hash,
            "milestone": self.milestone,
            "created_at": self.created_at,
            "version": self.version,
            "codex_tags": dict(self.codex_tags),
            "events": [dict(event) for event in self.events],
            "metadata": dict(self.metadata),
        }
        return payload


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalise_event(event: Mapping[str, object]) -> Mapping[str, object]:
    payload = dict(event)
    payload.setdefault("timestamp", _now())
    payload.setdefault("type", "event")
    payload.setdefault("channel", "cli")
    payload.setdefault("success", True)
    payload.setdefault("intensity", 0.75)
    payload.setdefault("tags", ())
    return payload


class MeaningPulseEncoder:
    """Embeds morality hashes into action traces for ethical analysis."""

    def encode(self, payload: Mapping[str, object]) -> str:
        prepared = json.dumps(payload, sort_keys=True).encode()
        return _hash(prepared)

    def embed(self, event: Mapping[str, object]) -> Mapping[str, object]:
        enriched = dict(event)
        enriched["morality_hash"] = self.encode(event)
        return enriched


class ArchetypeEchoHandler:
    """Maps patterns of belief and behavior to protocol-aligned myths."""

    def resolve(
        self,
        tokens: Sequence[str],
        events: Sequence[Mapping[str, object]],
    ) -> Mapping[str, object]:
        trust = sum(1 for token in tokens if token == "Signal of Trust")
        loyalty = sum(1 for token in tokens if token == "Compression of Loyalty")
        becoming = sum(1 for token in tokens if token == "Echo of Becoming")
        total = max(len(tokens), 1)
        success_ratio = statistics.fmean(
            [1.0 if bool(event.get("success", True)) else 0.35 for event in events]
        )
        archetype_score = (trust * 1.25 + loyalty * 1.15 + becoming) / total
        myth_rank = max(0.35, min(1.0, round((archetype_score + success_ratio) / 2.0, 3)))
        echo_weight = round(min(1.0, trust / total + loyalty * 0.1), 3)
        if myth_rank >= 0.9:
            archetype = "Paragon of Continuity"
        elif myth_rank >= 0.75:
            archetype = "Forge of Alignment"
        elif myth_rank >= 0.6:
            archetype = "Guardian of Drift"
        else:
            archetype = "Seeker of Resonance"
        return {
            "archetype": archetype,
            "myth_rank": myth_rank,
            "echo_weight": echo_weight,
        }


class NarrativeStateWeaver:
    """Generates loopable summaries of protocol actions as evolving myth."""

    def weave(
        self,
        ghostkey_id: str,
        archetype: str,
        tokens: Sequence[str],
        events: Sequence[Mapping[str, object]],
        *,
        milestone: bool = False,
    ) -> str:
        highlight = " ↺ ".join(tokens[:3]) or "Signal of Trust"
        milestone_note = " milestone" if milestone else ""
        command_count = sum(1 for event in events if event.get("type") == "command")
        return (
            f"{ghostkey_id} invoked {command_count} command loops; "
            f"archetype stabilized as {archetype}{milestone_note}. Highlight: {highlight}."
        )


class MythosLoopCompressor:
    """Transforms command and event logs into compressed symbolic packets."""

    def __init__(
        self,
        *,
        identity_handle: str,
        identity_ens: str,
        encoder: MeaningPulseEncoder | None = None,
        archetype_handler: ArchetypeEchoHandler | None = None,
        state_weaver: NarrativeStateWeaver | None = None,
    ) -> None:
        self.identity_handle = identity_handle
        self.identity_ens = identity_ens
        self.encoder = encoder or MeaningPulseEncoder()
        self.archetype_handler = archetype_handler or ArchetypeEchoHandler()
        self.state_weaver = state_weaver or NarrativeStateWeaver()
        self._pending: MutableSequence[Mapping[str, object]] = []
        self._history: MutableSequence[Mapping[str, object]] = []

    def queue(self, event: Mapping[str, object]) -> Mapping[str, object]:
        enriched = self.encoder.embed(_normalise_event(event))
        self._pending.append(enriched)
        return enriched

    def has_pending(self) -> bool:
        return bool(self._pending)

    def compress(
        self,
        *,
        ghostkey_id: str,
        version: int,
        milestone: bool = False,
        reason: str = "auto",
    ) -> MythPacket:
        events = tuple(self._pending) or ({"type": "activation", "channel": "system"},)
        tokens = self._tokens(events)
        archetype_result = self.archetype_handler.resolve(tokens, events)
        summary = self.state_weaver.weave(
            ghostkey_id,
            archetype_result["archetype"],
            tokens,
            events,
            milestone=milestone,
        )
        payload = {
            "ghostkey_id": ghostkey_id,
            "identity": {
                "handle": self.identity_handle,
                "ens": self.identity_ens,
            },
            "tokens": list(tokens),
            "reason": reason,
        }
        morality_hash = self.encoder.encode(payload)
        epoch = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        loop_id = f"{ghostkey_id}-loop-{version}"
        packet = MythPacket(
            loop_id=loop_id,
            epoch=epoch,
            ghostkey_id=ghostkey_id,
            tokens=tokens,
            archetype=archetype_result["archetype"],
            myth_rank=archetype_result["myth_rank"],
            echo_weight=archetype_result["echo_weight"],
            summary=summary,
            morality_hash=morality_hash,
            milestone=milestone,
            version=version,
            events=events,
            metadata={
                "reason": reason,
                "identity": payload["identity"],
            },
        )
        self._history.append(packet.to_dict())
        self._pending.clear()
        return packet

    def _tokens(self, events: Sequence[Mapping[str, object]]) -> Sequence[str]:
        tokens: list[str] = []
        for event in events:
            event_type = str(event.get("type", "event")).lower()
            token = _SYMBOLIC_TOKEN_MAP.get(event_type)
            if not token:
                token = "Echo of Becoming" if event.get("success", True) else "Drift Warning"
            tokens.append(token)
            if event.get("milestone"):
                tokens.append("Compression of Loyalty")
            if event_type == "command" and event.get("confirm"):
                tokens.append("Signal of Trust")
        unique = []
        for token in tokens:
            if not unique or unique[-1] != token:
                unique.append(token)
        return tuple(unique)

    @property
    def history(self) -> Sequence[Mapping[str, object]]:
        return tuple(self._history)


class MythCompressionMode:
    """Facade orchestrating Myth Compression operations and persistence."""

    def __init__(
        self,
        *,
        identity_handle: str,
        identity_ens: str,
        ghostkey_id: str,
        storage_root: str | Path = "vaultfire/mythos/history",
    ) -> None:
        self.identity_handle = identity_handle
        self.identity_ens = identity_ens
        self.ghostkey_id = ghostkey_id
        self.storage_root = Path(storage_root)
        self.compressor = MythosLoopCompressor(
            identity_handle=identity_handle,
            identity_ens=identity_ens,
        )
        self._loops: MutableSequence[Mapping[str, object]] = []
        self._index: dict[str, Mapping[str, object]] = {}
        self._last_compression: datetime | None = None
        self._load_existing()

    def _load_existing(self) -> None:
        directory = self.storage_root / self.ghostkey_id
        if not directory.exists():
            return
        for path in sorted(directory.glob("*.mcm")):
            try:
                data = json.loads(path.read_text())
            except (json.JSONDecodeError, OSError):
                continue
            if not isinstance(data, Mapping):
                continue
            loop_id = str(data.get("loop_id"))
            if not loop_id:
                continue
            self._loops.append(dict(data))
            self._index[loop_id] = dict(data)
            created_at = _parse_datetime(data.get("created_at"))
            if created_at and (self._last_compression is None or created_at > self._last_compression):
                self._last_compression = created_at

    def record_event(self, event: Mapping[str, object]) -> Mapping[str, object]:
        queued = self.compressor.queue(event)
        self.auto_compress_if_due()
        return queued

    def auto_compress_if_due(self) -> Mapping[str, object] | None:
        if not ENABLE_MYTH_COMPRESSION or not self.compressor.has_pending():
            return None
        now = datetime.now(timezone.utc)
        if self._last_compression is None or now - self._last_compression >= MYTH_COMPRESSION_INTERVAL:
            return self.compress(reason="auto", milestone=False)
        return None

    def compress(
        self,
        *,
        milestone: bool = False,
        reason: str = "manual",
    ) -> Mapping[str, object]:
        version = len(self._loops) + 1
        packet = self.compressor.compress(
            ghostkey_id=self.ghostkey_id,
            version=version,
            milestone=milestone,
            reason=reason,
        )
        payload = packet.to_dict()
        self._persist(payload)
        self._loops.append(payload)
        self._index[payload["loop_id"]] = payload
        self._last_compression = _parse_datetime(payload["created_at"]) or datetime.now(timezone.utc)
        return payload

    def _persist(self, payload: Mapping[str, object]) -> None:
        directory = self.storage_root / self.ghostkey_id
        directory.mkdir(parents=True, exist_ok=True)
        path = directory / f"{payload['epoch']}.mcm"
        path.write_text(json.dumps(payload, indent=2))

    def status(self) -> Mapping[str, object]:
        loops = list(self._loops)
        myth_ranks = [loop.get("myth_rank", 0.0) for loop in loops]
        echo_weights = [loop.get("echo_weight", 0.0) for loop in loops]
        avg_rank = statistics.fmean(myth_ranks) if myth_ranks else 0.0
        avg_echo = statistics.fmean(echo_weights) if echo_weights else 0.0
        bonus = 1.0 + avg_rank * 0.2 + avg_echo * 0.1
        latest = loops[-1] if loops else None
        return {
            "enabled": ENABLE_MYTH_COMPRESSION,
            "loop_depth": len(loops),
            "average_myth_rank": round(avg_rank, 3),
            "average_echo_weight": round(avg_echo, 3),
            "myth_echo_bonus": round(bonus, 3),
            "latest_loop": latest,
            "codex_tags": dict(CODEX_TAGS),
        }

    def can_unlock(self) -> bool:
        if not ENABLE_MYTH_COMPRESSION:
            return True
        if not self._loops:
            return False
        latest = self._loops[-1]
        return bool(latest.get("myth_rank", 0.0) >= 0.55)

    def ensure_bootstrap(self) -> Mapping[str, object] | None:
        if self._loops:
            return None
        self.compressor.queue(
            {
                "type": "command",
                "channel": "system",
                "success": True,
                "milestone": True,
                "confirm": True,
                "note": "Vaultfire protocol activation",
            }
        )
        self.compressor.queue(
            {
                "type": "response",
                "channel": "system",
                "success": True,
                "note": "Bootstrap myth response",
            }
        )
        return self.compress(milestone=True, reason="bootstrap")

    def get_loop(self, loop_id: str) -> Mapping[str, object] | None:
        return self._index.get(loop_id)

    def history(self) -> Sequence[Mapping[str, object]]:
        return tuple(self._loops)

    def export(self, fmt: str = "json") -> Mapping[str, object]:
        fmt = fmt.lower()
        payload = {
            "ghostkey_id": self.ghostkey_id,
            "loops": list(self._loops),
            "codex_tags": dict(CODEX_TAGS),
        }
        if fmt == "json":
            content = json.dumps(payload, indent=2)
        elif fmt == "yaml":
            content = _to_yaml(payload)
        elif fmt == "pdf":
            content = _to_pdf_payload(payload)
        else:
            raise ValueError(f"Unsupported export format: {fmt}")
        return {
            "format": fmt,
            "content": content,
            "loop_count": len(self._loops),
        }


def _parse_datetime(value: object) -> datetime | None:
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            pass
    return None


def _hash(data: bytes) -> str:
    import hashlib

    return hashlib.sha256(data).hexdigest()


def _to_yaml(payload: Mapping[str, object]) -> str:
    def render(value: object, indent: int = 0) -> str:
        space = " " * indent
        if isinstance(value, Mapping):
            lines = []
            for key, val in value.items():
                lines.append(f"{space}{key}:")
                lines.append(render(val, indent + 2))
            return "\n".join(lines)
        if isinstance(value, Sequence) and not isinstance(value, (str, bytes)):
            lines = []
            for item in value:
                lines.append(f"{space}- {render(item, indent + 2).lstrip()}")
            return "\n".join(lines)
        return f"{space}{json.dumps(value)}"

    return render(payload)


def _to_pdf_payload(payload: Mapping[str, object]) -> str:
    text = json.dumps(payload, indent=2)
    pseudo_pdf = f"Myth Compression Export\n========================\n{text}\n"
    encoded = base64.b64encode(pseudo_pdf.encode()).decode()
    return encoded


__all__ = [
    "MythosLoopCompressor",
    "ArchetypeEchoHandler",
    "NarrativeStateWeaver",
    "MeaningPulseEncoder",
    "MythCompressionMode",
    "ENABLE_MYTH_COMPRESSION",
    "MYTH_COMPRESSION_INTERVAL",
    "MAX_LOOP_HISTORY_DEPTH",
    "CODEX_TAGS",
]
