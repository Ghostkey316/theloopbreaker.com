"""Chainlink Proof of Reserve integration utilities for Vaultfire."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Mapping

from utils.json_io import load_json, write_json
from vaultfire.mission import LedgerMetadata, MissionLedger

_ROOT = Path(__file__).resolve().parents[2]
_TRUST_DIR = Path(__file__).resolve().parent
_POR_PATH = _TRUST_DIR / "proof_of_reserve.json"
_COMPANION_STATUS_PATH = _ROOT / "vaultfire-core" / "companion_echo_status.json"
_PARTNER_KIT_PATH = _ROOT / "vaultfire" / "docs" / "partner_kit_v3.1.zora.json"
_CONTRIBUTOR_REGISTRY_PATH = _ROOT / "contributor_registry.json"
_CODEX_LEDGER_PATH = _ROOT / "codex" / "VAULTFIRE_CLI_LEDGER.jsonl"

_DEFAULT_STATE: Dict[str, Any] = {
    "source": "chainlink",
    "last_check": None,
    "verified": False,
    "reserves": {
        "ASM": 0.0,
        "PoP": 0.0,
        "ETH": 0.0,
    },
    "oracle": {"status": "cold", "latency_ms": None},
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


def _load_state() -> Dict[str, Any]:
    state = load_json(_POR_PATH, _DEFAULT_STATE)
    reserves = state.setdefault("reserves", {})
    for key in ("ASM", "PoP", "ETH"):
        reserves.setdefault(key, 0.0)
    state.setdefault("oracle", {"status": "cold", "latency_ms": None})
    return state


def _write_state(state: Mapping[str, Any]) -> None:
    write_json(_POR_PATH, state)


def _sync_companion_layer(verified: bool, *, timestamp: str) -> None:
    state = load_json(_COMPANION_STATUS_PATH, {"deployments": []})
    state["PoR_verified"] = bool(verified)
    state["last_trust_sync"] = timestamp
    write_json(_COMPANION_STATUS_PATH, state)


def _sync_partner_kit(status: str) -> None:
    data = load_json(_PARTNER_KIT_PATH, {})
    attributes = list(data.get("attributes", []))
    filtered = [
        attr
        for attr in attributes
        if attr.get("trait_type") != "Integration: Chainlink PoR"
    ]
    filtered.append({"trait_type": "Integration: Chainlink PoR", "value": status})
    data["attributes"] = filtered
    checklist = list(data.get("checklist", []))
    badge = "Chainlink Proof of Reserve verified"
    if badge not in checklist and status.lower() == "active":
        checklist.append(badge)
    elif badge in checklist and status.lower() != "active":
        checklist.remove(badge)
    data["checklist"] = checklist
    write_json(_PARTNER_KIT_PATH, data)


def _sync_contributor_registry(verified: bool) -> None:
    registry = load_json(_CONTRIBUTOR_REGISTRY_PATH, {})
    if not isinstance(registry, dict):
        return
    updated = False
    for record in registry.values():
        if isinstance(record, dict):
            record["proof_of_reserve_verified"] = bool(verified)
            if verified:
                record["tier_eligibility"] = "confirmed"
            else:
                record.pop("tier_eligibility", None)
            updated = True
    if updated:
        write_json(_CONTRIBUTOR_REGISTRY_PATH, registry)


def verify_reserve(asset: str, threshold: float) -> Dict[str, Any]:
    """Validate that ``asset`` meets the Chainlink PoR ``threshold``."""

    if threshold < 0:
        raise ValueError("threshold must be non-negative")

    asset_key = asset.strip().upper()
    if not asset_key:
        raise ValueError("asset must be provided")

    state = _load_state()
    reserves = state.get("reserves", {})
    if asset_key not in reserves:
        raise KeyError(f"Asset '{asset_key}' not tracked by Proof of Reserve")

    reserve_amount = float(reserves[asset_key])
    meets_threshold = reserve_amount >= float(threshold)
    timestamp = _utcnow()
    state["last_check"] = timestamp
    state["verified"] = meets_threshold
    state.setdefault("oracle", {})["status"] = "connected" if meets_threshold else "degraded"
    state.setdefault("oracle", {})["latency_ms"] = state.get("oracle", {}).get("latency_ms")
    _write_state(state)

    payload = {
        "asset": asset_key,
        "reserve": reserve_amount,
        "threshold": float(threshold),
        "verified": meets_threshold,
        "source": state.get("source", "chainlink"),
        "timestamp": timestamp,
    }
    _append_codex_event("chainlink-por-check", payload)

    ledger = MissionLedger.default(component="chainlink-por")
    ledger.append(
        "chainlink-por-check",
        payload,
        metadata=LedgerMetadata(
            narrative="Chainlink Proof of Reserve verification",
            tags=("chainlink", asset_key.lower(), "proof-of-reserve"),
            extra={"badge_synced": bool(meets_threshold)},
        ),
    )

    if meets_threshold:
        _sync_companion_layer(True, timestamp=timestamp)
        _sync_partner_kit("active")
        _sync_contributor_registry(True)
    else:
        _sync_companion_layer(False, timestamp=timestamp)
        _sync_partner_kit("paused")
        _sync_contributor_registry(False)

    return payload


__all__ = ["verify_reserve"]
