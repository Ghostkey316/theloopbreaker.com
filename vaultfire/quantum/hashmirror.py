"""QuantumHashMirror utilities for unique reward identity tags."""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
from typing import Dict, Mapping, MutableMapping


@dataclass(frozen=True)
class QuantumMirrorRecord:
    """Immutable representation of a mirror imprint."""

    tag: str
    subject: str
    context: Mapping[str, object]


class QuantumHashMirror:
    """Generate non-replicable identity tags for reward claims.

    The mirror maintains a local registry of issued tags so callers can
    validate ownership before fulfilling a reward. Tags are deterministically
    derived from a caller provided seed combined with an incrementing counter
    to guarantee uniqueness while still being reproducible in tests.
    """

    PREFIX = "QHM"

    def __init__(self, *, seed: str = "ghostkey-quantum") -> None:
        self._seed = seed
        self._counter = 0
        self._registry: MutableMapping[str, QuantumMirrorRecord] = {}

    def imprint(
        self,
        subject: str,
        *,
        interaction_id: str,
        branch: str,
        payload: Mapping[str, object] | None = None,
    ) -> str:
        """Return a unique tag representing ``subject`` within ``payload``."""

        self._counter += 1
        snapshot = {
            "interaction_id": interaction_id,
            "branch": branch,
            "payload": dict(payload or {}),
            "counter": self._counter,
        }
        encoded = json.dumps(snapshot, sort_keys=True)
        digest = hashlib.sha256(f"{self._seed}:{subject}:{encoded}".encode()).hexdigest()
        tag = f"{self.PREFIX}-{digest[:20]}"
        record = QuantumMirrorRecord(tag=tag, subject=subject, context=snapshot)
        self._registry[tag] = record
        return tag

    def resolve(self, tag: str) -> QuantumMirrorRecord | None:
        """Return the stored record for ``tag`` if known."""

        return self._registry.get(tag)

    def verify(self, tag: str, subject: str) -> bool:
        """Return ``True`` when ``tag`` belongs to ``subject``."""

        record = self.resolve(tag)
        return bool(record and record.subject == subject)

    def snapshot(self) -> Dict[str, Dict[str, object]]:
        """Return a serializable snapshot of the registry."""

        return {
            tag: {"subject": rec.subject, "context": dict(rec.context)}
            for tag, rec in self._registry.items()
        }

