"""Telemetry log helpers for Vaultfire simulations."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, Mapping

from vaultfire.security.fhe import FHECipherSuite

_REPO_ROOT = Path(__file__).resolve().parents[2]
_CHAIN_PATH = _REPO_ROOT / "telemetry" / "telemetry_chain.jsonl"


def _load_last_hash() -> str | None:
    if not _CHAIN_PATH.exists():
        return None
    try:
        last_line = _CHAIN_PATH.read_text(encoding="utf-8").strip().splitlines()[-1]
    except IndexError:
        return None
    if not last_line:
        return None
    try:
        payload = json.loads(last_line)
    except json.JSONDecodeError:  # pragma: no cover - corrupt record guard
        return None
    return payload.get("hash")


def log_telemetry_event(
    *,
    wallet_id: str,
    event_type: str,
    mission_id: str,
    metadata: Dict[str, Any] | None = None,
    cipher_suite: FHECipherSuite | None = None,
    private_metadata: Mapping[str, Any] | None = None,
    cross_chain_domains: Iterable[str] | None = None,
) -> Dict[str, Any]:
    """Append a telemetry event to the local chain log."""

    if not wallet_id or not wallet_id.strip():
        raise ValueError("wallet_id must be provided")
    if not event_type or not event_type.strip():
        raise ValueError("event_type must be provided")
    if not mission_id or not mission_id.strip():
        raise ValueError("mission_id must be provided")

    metadata = metadata or {}
    base_event = {
        "wallet_id": wallet_id.strip(),
        "event_type": event_type.strip(),
        "mission_id": mission_id.strip(),
        "metadata": metadata,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    prev_hash = _load_last_hash()
    hasher = hashlib.sha256()
    hasher.update(json.dumps(base_event, sort_keys=True).encode("utf-8"))
    if prev_hash:
        hasher.update(prev_hash.encode("utf-8"))
    event_hash = hasher.hexdigest()

    record: Dict[str, Any] = {
        **base_event,
        "hash": event_hash,
        "prev_hash": prev_hash,
    }

    if cipher_suite:
        sensitive_payload = dict(private_metadata or {})
        ciphertext = cipher_suite.encrypt_record(
            {**sensitive_payload, "wallet_id": wallet_id, "event_type": event_type},
            sensitive_fields=sensitive_payload.keys(),
        )
        record["fhe"] = {
            "ciphertext": ciphertext.serialize(),
            "commitment": cipher_suite.generate_zero_knowledge_commitment(
                ciphertext, context=f"telemetry::{event_type}"
            ),
            "domains": list(cross_chain_domains or ()),
            "moral_tag": cipher_suite.moral_tag,
        }

    _CHAIN_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _CHAIN_PATH.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record) + "\n")

    return record


def log_private_behavioral_signal(
    *,
    wallet_id: str,
    signal_type: str,
    mission_id: str,
    payload: Mapping[str, Any],
    cipher_suite: FHECipherSuite,
    moral_orientation: str,
    cross_chain_domains: Iterable[str] | None = None,
) -> Dict[str, Any]:
    """Log an encrypted behavioral signal with telemetry provenance."""

    from .fhe_bridge import prepare_private_signal

    private_signal = prepare_private_signal(
        wallet_id=wallet_id,
        signal_type=signal_type,
        payload=payload,
        cipher_suite=cipher_suite,
        moral_orientation=moral_orientation,
    )
    record = log_telemetry_event(
        wallet_id=wallet_id,
        event_type=signal_type,
        mission_id=mission_id,
        metadata={"privacy": "fhe"},
        cipher_suite=cipher_suite,
        private_metadata=payload,
        cross_chain_domains=cross_chain_domains,
    )
    record["private_signal"] = private_signal.export()
    return record


__all__ = ["log_telemetry_event", "log_private_behavioral_signal"]
