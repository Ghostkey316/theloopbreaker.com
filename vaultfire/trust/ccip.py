"""Chainlink CCIP integration helpers for Vaultfire."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, MutableMapping
from uuid import uuid4

from utils.json_io import load_json, write_json
from vaultfire.mission import LedgerMetadata, MissionLedger

_ROOT = Path(__file__).resolve().parents[2]
_LOG_PATH = _ROOT / "vaultfire" / "logs" / "ccip_transmissions.json"
_CONTRIBUTOR_REGISTRY_PATH = _ROOT / "contributor_registry.json"
_CODEX_LEDGER_PATH = _ROOT / "codex" / "VAULTFIRE_CLI_LEDGER.jsonl"

_SUPPORTED_CHAINS: tuple[str, ...] = ("base", "ethereum", "solana", "polygon", "optimism")

_DEFAULT_LOG: Dict[str, Any] = {
    "transmissions": [],
    "chain_health": {chain: {"status": "healthy", "last_checked": None} for chain in _SUPPORTED_CHAINS},
}


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def _append_codex_event(event: str, payload: Mapping[str, Any]) -> None:
    _CODEX_LEDGER_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _CODEX_LEDGER_PATH.open("a", encoding="utf-8") as handle:
        handle.write(
            json.dumps(
                {
                    "timestamp": _utcnow(),
                    "event": event,
                    "payload": dict(payload),
                },
                sort_keys=True,
            )
            + "\n"
        )


def _load_log() -> Dict[str, Any]:
    data = load_json(_LOG_PATH, _DEFAULT_LOG)
    if not isinstance(data, dict):
        data = dict(_DEFAULT_LOG)
    transmissions = data.setdefault("transmissions", [])
    if not isinstance(transmissions, list):
        data["transmissions"] = []
    chain_health = data.setdefault("chain_health", {})
    if not isinstance(chain_health, dict):
        chain_health = {}
        data["chain_health"] = chain_health
    for chain in _SUPPORTED_CHAINS:
        chain_health.setdefault(chain, {"status": "healthy", "last_checked": None})
    return data


def _write_log(data: Mapping[str, Any]) -> None:
    write_json(_LOG_PATH, data)


def _serialise_payload(payload: Mapping[str, Any] | Iterable[tuple[str, Any]]) -> Dict[str, Any]:
    if isinstance(payload, Mapping):
        candidate: MutableMapping[str, Any] = dict(payload)
    else:
        candidate = dict(payload)
    try:
        json.dumps(candidate)
        return dict(candidate)
    except TypeError:
        return json.loads(json.dumps(candidate, default=str))


def _load_contributor_identity() -> Dict[str, Any]:
    registry = load_json(_CONTRIBUTOR_REGISTRY_PATH, {})
    if isinstance(registry, dict):
        for record in registry.values():
            if isinstance(record, dict):
                return {
                    "identity": record.get("identity"),
                    "wallet": record.get("metadata_lock", {}).get("wallet"),
                    "ens": record.get("ens"),
                    "role": record.get("role"),
                }
    return {"identity": "Ghostkey-316", "wallet": None, "ens": None, "role": None}


def _enable_cross_chain_flag() -> None:
    registry = load_json(_CONTRIBUTOR_REGISTRY_PATH, {})
    if not isinstance(registry, dict):
        return
    modified = False
    for record in registry.values():
        if isinstance(record, dict):
            if not record.get("cross_chain_enabled"):
                record["cross_chain_enabled"] = True
                modified = True
            else:
                record["cross_chain_enabled"] = True
            record.setdefault("proof_of_reserve_verified", record.get("proof_of_reserve_verified", False))
    if modified:
        write_json(_CONTRIBUTOR_REGISTRY_PATH, registry)


def supported_chains() -> tuple[str, ...]:
    return _SUPPORTED_CHAINS


def check_ccip_status(chain: str) -> Dict[str, Any]:
    chain_key = chain.strip().lower()
    if not chain_key:
        raise ValueError("chain must be provided")

    data = _load_log()
    chain_health = data.setdefault("chain_health", {})
    status_entry = chain_health.setdefault(chain_key, {"status": "unknown", "last_checked": None})
    status_entry = dict(status_entry)
    status_entry["last_checked"] = _utcnow()
    chain_health[chain_key] = status_entry
    _write_log(data)

    payload = {
        "chain": chain_key,
        "status": status_entry.get("status", "unknown"),
        "last_checked": status_entry["last_checked"],
    }
    _append_codex_event("ccip-status-check", payload)

    ledger = MissionLedger.default(component="chainlink-ccip")
    ledger.append(
        "ccip-status-check",
        payload,
        metadata=LedgerMetadata(
            narrative="Chainlink CCIP status check",
            tags=("ccip", chain_key),
            extra={},
        ),
    )
    return payload


def broadcast_belief_cross_chain(destination_chain: str, payload: Mapping[str, Any]) -> Dict[str, Any]:
    chain_key = destination_chain.strip().lower()
    if not chain_key:
        raise ValueError("destination_chain must be provided")
    if chain_key not in _SUPPORTED_CHAINS:
        raise ValueError(f"Unsupported chain '{chain_key}'")

    status_info = check_ccip_status(chain_key)
    normalized_payload = _serialise_payload(payload)
    transmission_status = "delivered" if status_info["status"] in {"healthy", "standby"} else "queued"

    entry = {
        "id": uuid4().hex,
        "chain": chain_key,
        "payload": normalized_payload,
        "bridge_status": status_info["status"],
        "transmission_status": transmission_status,
        "timestamp": status_info["last_checked"],
    }

    data = _load_log()
    transmissions: List[Mapping[str, Any]] = data.setdefault("transmissions", [])  # type: ignore[assignment]
    transmissions.append(entry)
    _write_log(data)

    _append_codex_event("ccip-broadcast", entry)

    ledger = MissionLedger.default(component="chainlink-ccip")
    ledger.append(
        "ccip-transmission",
        entry,
        metadata=LedgerMetadata(
            narrative="Chainlink CCIP broadcast",
            tags=("ccip", chain_key),
            extra={"transmission_status": transmission_status},
        ),
    )
    return entry


def sync_identity_all_chains(identity_payload: Mapping[str, Any] | None = None) -> List[Dict[str, Any]]:
    payload = _serialise_payload(identity_payload or _load_contributor_identity())
    results = []
    for chain in _SUPPORTED_CHAINS:
        enriched = dict(payload)
        enriched.setdefault("signal", "identity-sync")
        enriched.setdefault("origin", "vaultfire")
        enriched["destination"] = chain
        results.append(broadcast_belief_cross_chain(chain, enriched))
    _enable_cross_chain_flag()
    return results


__all__ = [
    "broadcast_belief_cross_chain",
    "check_ccip_status",
    "supported_chains",
    "sync_identity_all_chains",
]
