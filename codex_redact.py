"""Ghostkey memory redaction controls."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from hashlib import sha256
import json
from pathlib import Path
from typing import Iterable, Mapping, MutableMapping, Sequence

_MEMORY_PATH = Path("vault_memory.py")
_REDACTION_RECEIPT = Path("codex_redaction_receipt.json")
_ARCHIVE_PATH = Path(".codex_archive")


@dataclass(slots=True)
class RedactionEvent:
    """Structured redaction action."""

    trigger: str
    occurred_at: str
    scope: Sequence[str]
    checksum: str

    def to_dict(self) -> Mapping[str, object]:
        return {
            "trigger": self.trigger,
            "occurred_at": self.occurred_at,
            "scope": list(self.scope),
            "checksum": self.checksum,
        }


class CodexRedactor:
    """Apply time and signal based memory purges."""

    def __init__(self, *, memory_path: Path | None = None) -> None:
        self._memory_path = memory_path or _MEMORY_PATH

    def expire_after(self, *, hours: int = 72, archive: bool = False) -> RedactionEvent:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        return self._purge("time-expiry", cutoff=cutoff, archive=archive)

    def signal(self, signal_code: str, *, archive: bool = False) -> RedactionEvent:
        trigger = signal_code.strip()
        if not trigger:
            raise ValueError("signal_code cannot be empty")
        return self._purge(trigger, archive=archive)

    def manual_purge(self, *, signed_prompt: Mapping[str, object], archive: bool = False) -> RedactionEvent:
        signature = signed_prompt.get("signature")
        if not signature:
            raise ValueError("signed_prompt must contain a signature")
        message = signed_prompt.get("message", "manual-purge")
        trigger = f"manual:{signature}:{message}"
        return self._purge(trigger, archive=archive)

    # ------------------------------------------------------------------
    # core purge logic
    # ------------------------------------------------------------------
    def _purge(
        self,
        trigger: str,
        *,
        cutoff: datetime | None = None,
        archive: bool,
    ) -> RedactionEvent:
        entries = self._load_memory()
        retained: MutableMapping[str, object] = {}
        removed_keys: list[str] = []
        for key, payload in entries.items():
            timestamp = self._extract_timestamp(payload)
            if cutoff is not None and timestamp and timestamp < cutoff:
                removed_keys.append(key)
                continue
            if cutoff is None and trigger.startswith("!ghostkey"):
                removed_keys.append(key)
                continue
            retained[key] = payload
        checksum = sha256(json.dumps(removed_keys, sort_keys=True).encode("utf-8")).hexdigest()
        self._write_memory(retained, archive=archive, removed_keys=removed_keys)
        event = RedactionEvent(
            trigger=trigger,
            occurred_at=datetime.now(timezone.utc).isoformat(),
            scope=removed_keys,
            checksum=checksum,
        )
        self._write_receipt(event)
        return event

    def _load_memory(self) -> MutableMapping[str, object]:
        if not self._memory_path.exists():
            return {}
        try:
            raw = self._memory_path.read_text(encoding="utf-8")
        except OSError:
            return {}
        context: MutableMapping[str, object] = {}
        for line in raw.splitlines():
            if "=" in line and not line.strip().startswith("#"):
                key, value = line.split("=", 1)
                context[key.strip()] = value.strip()
        return context

    def _write_memory(
        self,
        retained: MutableMapping[str, object],
        *,
        archive: bool,
        removed_keys: Sequence[str],
    ) -> None:
        if archive:
            _ARCHIVE_PATH.mkdir(exist_ok=True)
            archive_file = _ARCHIVE_PATH / f"memory-{int(datetime.now().timestamp())}.json"
            archive_payload = {
                "retained": retained,
                "removed": list(removed_keys),
            }
            archive_file.write_text(json.dumps(archive_payload, indent=2, sort_keys=True), encoding="utf-8")
        text = "\n".join(f"{key}={value}" for key, value in retained.items())
        self._memory_path.write_text(text, encoding="utf-8")

    def _write_receipt(self, event: RedactionEvent) -> None:
        _REDACTION_RECEIPT.write_text(
            json.dumps(event.to_dict(), indent=2, sort_keys=True),
            encoding="utf-8",
        )

    def _extract_timestamp(self, payload: object) -> datetime | None:
        if isinstance(payload, Mapping):
            raw_timestamp = payload.get("timestamp")
        else:
            raw_timestamp = None
        if not raw_timestamp:
            return None
        try:
            return datetime.fromisoformat(str(raw_timestamp))
        except ValueError:
            return None


def run_default_controls() -> Sequence[RedactionEvent]:
    """Run default expiry and signal checks."""

    redactor = CodexRedactor()
    events: list[RedactionEvent] = []
    events.append(redactor.expire_after(hours=72))
    events.append(redactor.signal("!ghostkey_vanish"))
    return events


__all__ = [
    "CodexRedactor",
    "RedactionEvent",
    "run_default_controls",
]
