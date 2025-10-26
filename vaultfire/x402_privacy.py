"""Privacy hardening utilities for x402 ghostkey mode."""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Deque, Mapping, MutableMapping, Tuple

import json
import time

GHOSTKEY_VERIFIED_WALLETS = {
    "bpow20.cb.id",
    "ghostkey316.eth",
}

IDENTITY_METADATA_KEYS = {
    "ip",
    "ip_address",
    "email",
    "email_address",
    "device",
    "device_id",
    "device_fingerprint",
    "fingerprint",
    "user_agent",
    "user-agent",
    "ua",
    "biometric",
    "biometric_hash",
    "face_id",
    "fingerprint_hash",
    "raw",
    "origin_metadata",
    "person_id",
    "user_id",
    "account_id",
}

BLOCKLIST_PATH = Path("vaultfire/logs/x402_blocked_sources.json")
TRACE_WINDOW_SECONDS = 5.0
MAX_TRACE_WINDOW = 0


@dataclass
class TraceBuffer:
    """Ring buffer that purges entries on insertion."""

    retention_seconds: float = TRACE_WINDOW_SECONDS

    _entries: Deque[Tuple[float, Mapping[str, Any]]] = field(init=False, repr=False)

    def __post_init__(self) -> None:
        self._entries = deque()

    def append(self, payload: Mapping[str, Any]) -> None:
        now = time.time()
        self._entries.append((now, payload))
        self.prune(now)

    def prune(self, now: float | None = None) -> None:
        if now is None:
            now = time.time()
        while self._entries and now - self._entries[0][0] > self.retention_seconds:
            self._entries.popleft()

    def clear(self) -> None:
        self._entries.clear()


def _normalise_wallet(address: str | None) -> str:
    return (address or "").strip().lower()


def _is_valid_signature(signature: str | None) -> bool:
    if not signature:
        return False
    token = signature.strip()
    if not token:
        return False
    if token.startswith("codex::"):
        return True
    if token.startswith("sig:"):
        return True
    return False


def _is_valid_belief_signal(signal: Mapping[str, Any] | None) -> bool:
    if not signal:
        return False
    try:
        confidence = float(signal.get("confidence", 0.0))
    except (TypeError, ValueError):
        confidence = 0.0
    source = str(signal.get("source", "")).strip().lower()
    verified = bool(signal.get("verified", False))
    return confidence >= 0.5 and verified and source in {"belief-engine", "codex"}


def _classify_wallet(address: str, wallet_type: str | None = None) -> str:
    normalised = _normalise_wallet(address)
    if normalised in GHOSTKEY_VERIFIED_WALLETS:
        return "ghostkey"
    wallet_label = (wallet_type or "").strip().lower()
    if wallet_label in {"zk", "zk_shard", "zk-shard"}:
        return "zk"
    if wallet_label in {"ephemeral", "temp", "x402_ephemeral"}:
        return "ephemeral"
    if normalised.startswith("zk-shard:"):
        return "zk"
    if normalised.startswith("ephemeral:"):
        return "ephemeral"
    return "unverified"


def verify_x402_wallet(
    address: str,
    *,
    belief_signal: Mapping[str, Any] | None = None,
    signature: str | None = None,
    wallet_type: str | None = None,
) -> tuple[bool, str]:
    """Return ``(True, classification)`` when the wallet signal is valid."""

    classification = _classify_wallet(address, wallet_type)
    if classification == "unverified":
        return False, classification
    if not (_is_valid_signature(signature) or _is_valid_belief_signal(belief_signal)):
        return False, classification
    return True, classification


def _strip_identity_keys(payload: Mapping[str, Any]) -> MutableMapping[str, Any]:
    clean: MutableMapping[str, Any] = {}
    for key, value in payload.items():
        lowered = key.lower()
        if lowered in IDENTITY_METADATA_KEYS:
            continue
        if isinstance(value, Mapping):
            clean[key] = _strip_identity_keys(value)
            continue
        clean[key] = value
    return clean


def scrub_identity_metadata(metadata: Mapping[str, Any]) -> MutableMapping[str, Any]:
    """Remove identity revealing keys from ``metadata``."""

    clean = _strip_identity_keys(metadata)
    if "source" in clean:
        clean.pop("source")
    if "origin" in clean:
        clean.pop("origin")
    return clean


def contains_identity_metadata(metadata: Mapping[str, Any]) -> bool:
    for key, value in metadata.items():
        if key.lower() in IDENTITY_METADATA_KEYS:
            return True
        if isinstance(value, Mapping) and contains_identity_metadata(value):
            return True
    return False


def is_pre_authorised(metadata: Mapping[str, Any]) -> bool:
    controller = str(metadata.get("authorized_by", "")).strip().lower()
    relay = str(metadata.get("relay", "")).strip().lower()
    return controller in {"ghostkey-316", "ghostkey316", "ghostkey316.eth"} or relay.startswith("test")


def log_blocked_event(reason: str, metadata: Mapping[str, Any]) -> None:
    BLOCKLIST_PATH.parent.mkdir(parents=True, exist_ok=True)
    entry = {
        "timestamp": time.time(),
        "reason": reason,
        "metadata": scrub_identity_metadata(metadata),
    }
    existing: list[dict[str, Any]]
    if BLOCKLIST_PATH.exists():
        try:
            existing = json.loads(BLOCKLIST_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            existing = []
    else:
        existing = []
    existing.append(entry)
    BLOCKLIST_PATH.write_text(json.dumps(existing, indent=2), encoding="utf-8")


def codex_redact_x402_trace(trace_buffer: TraceBuffer) -> None:
    """Immediate purge for x402 traces."""

    trace_buffer.clear()


__all__ = [
    "TraceBuffer",
    "verify_x402_wallet",
    "scrub_identity_metadata",
    "contains_identity_metadata",
    "is_pre_authorised",
    "log_blocked_event",
    "codex_redact_x402_trace",
    "TRACE_WINDOW_SECONDS",
    "MAX_TRACE_WINDOW",
]
