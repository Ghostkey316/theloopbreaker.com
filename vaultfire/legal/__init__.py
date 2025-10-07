"""Legal disclosure utilities for Vaultfire v6.0 deployments."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Mapping, MutableSequence, Sequence

__all__ = ["DisclosureShieldTrailEngine"]


def _now_ts() -> str:
    return datetime.now(timezone.utc).isoformat()


def _fingerprint(payload: Mapping[str, object]) -> str:
    digest = hashlib.sha256()
    digest.update(json.dumps(payload, sort_keys=True).encode("utf-8"))
    return digest.hexdigest()


@dataclass
class _TrailEntry:
    label: str
    payload: Mapping[str, object]
    recorded_at: str
    digest: str

    def to_payload(self) -> Mapping[str, object]:
        return {
            "label": self.label,
            "payload": dict(self.payload),
            "recorded_at": self.recorded_at,
            "digest": self.digest,
        }


class DisclosureShieldTrailEngine:
    """Maintains a cryptographically anchored disclosure audit trail."""

    def __init__(self) -> None:
        self._trail: MutableSequence[_TrailEntry] = []
        self._sealed = False

    def record(self, label: str, payload: Mapping[str, object]) -> Mapping[str, object]:
        if self._sealed:
            raise RuntimeError("disclosure trail is sealed")
        normalised = {key: payload[key] for key in payload}
        entry = _TrailEntry(
            label=str(label),
            payload=normalised,
            recorded_at=_now_ts(),
            digest=_fingerprint({"label": label, **normalised}),
        )
        self._trail.append(entry)
        return entry.to_payload()

    def export(self) -> Sequence[Mapping[str, object]]:
        return tuple(entry.to_payload() for entry in self._trail)

    def seal(self) -> None:
        self._sealed = True

    def sealed(self) -> bool:
        return self._sealed

    def status(self) -> Mapping[str, object]:
        return {
            "entries": len(self._trail),
            "sealed": self._sealed,
            "latest_digest": self._trail[-1].digest if self._trail else None,
        }

    def summary(self) -> Mapping[str, object]:
        return {
            "trail": list(self.export()),
            "status": self.status(),
        }

