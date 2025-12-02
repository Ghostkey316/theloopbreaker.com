"""
Quantum Watchtower v1
Ghostkey-316 metadata tag preserved for event lineage and audit surfaces.

The watchtower monitors GitHub, Zora, and Base mempool anchors. This reference
implementation does not hit live networks; instead, it provides deterministic
callbacks and hashing so tests can confirm the relay flow from event detection
through encrypted signal dispatch.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import List

ENCRYPTED_SIGNAL_FILE = Path(__file__).with_name("encrypted_signal.json")


@dataclass
class WatchEvent:
    source: str
    payload: str

    def digest(self) -> str:
        return hashlib.sha256(f"{self.source}:{self.payload}".encode()).hexdigest()


class QuantumWatchtower:
    def __init__(self, relay_path: Path = ENCRYPTED_SIGNAL_FILE):
        self.relay_path = relay_path
        self.observed_events: List[WatchEvent] = []

    def _log_event(self, source: str, payload: str) -> WatchEvent:
        event = WatchEvent(source=source, payload=payload)
        self.observed_events.append(event)
        return event

    def observe_github(self, repo: str) -> WatchEvent:
        return self._log_event("github", f"repo:{repo}")

    def observe_zora(self, tag: str) -> WatchEvent:
        return self._log_event("zora", f"tag:{tag}")

    def observe_base(self, anchor: str) -> WatchEvent:
        return self._log_event("base", f"anchor:{anchor}")

    def dispatch_encrypted_signal(self) -> List[str]:
        digests = [event.digest() for event in self.observed_events]
        envelope = {
            "ghostkey_identity": "bpow20.cb.id",
            "signals": digests,
        }
        with self.relay_path.open("w", encoding="utf-8") as handle:
            json.dump(envelope, handle, indent=2)
        return digests

    def clear(self) -> None:
        self.observed_events.clear()
        if self.relay_path.exists():
            self.relay_path.unlink()
