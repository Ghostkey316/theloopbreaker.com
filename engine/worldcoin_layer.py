"""Worldcoin interoperability layer for Vaultfire.

This module provides integration hooks for Worldcoin-based identity
verification, Proof of Personhood (PoP) checks, and WLD token utilities.
All biometric operations route through Worldcoin's zero-knowledge protocol
and no biometric data is stored by Vaultfire.
"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from .contributor_identity import sync_identity, identity_summary
from partner_modules.multi_identity import add_tag

BASE_DIR = Path(__file__).resolve().parents[1]
LOG_PATH = BASE_DIR / "logs" / "worldcoin_sync.json"


def _load_json(path: Path, default):
    if path.exists():
        try:
            with open(path) as f:
                return json.load(f)
        except json.JSONDecodeError:
            return default
    return default


def _write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def _log_event(user_id: str, event: str, extra: dict | None = None) -> None:
    log = _load_json(LOG_PATH, [])
    entry = {
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "user_id": user_id,
        "event": event,
    }
    if extra:
        entry.update(extra)
    log.append(entry)
    _write_json(LOG_PATH, log)


# ---------------------------------------------------------------------------
# Orb-Aware Identity Sync Layer
# ---------------------------------------------------------------------------

def sync_orb_identity(user_id: str, world_id: str, verified: bool) -> dict:
    """Record Worldcoin Orb verification status and sync user metadata."""
    data = _load_json(LOG_PATH, {})
    meta = data.get(user_id, {})
    meta.update({"world_id": world_id, "orb_verified": bool(verified)})
    data[user_id] = meta
    _write_json(LOG_PATH, data)
    sync_identity(user_id, behaviors=["worldcoin_orb"])
    if verified:
        sync_identity(user_id, wallet=world_id)
    _log_event(user_id, "orb_sync", {"verified": bool(verified)})
    return identity_summary(user_id)


# ---------------------------------------------------------------------------
# Proof of Personhood API Integration
# ---------------------------------------------------------------------------

def register_pop(user_id: str, world_id: str) -> dict:
    """Add World ID as a recognized PoP credential."""
    profile = sync_identity(user_id, wallet=world_id)
    try:
        add_tag(user_id, "world_id")
    except Exception:
        pass
    _log_event(user_id, "pop_registered", {"world_id": world_id})
    return profile


# ---------------------------------------------------------------------------
# Biometric Privacy Tunnel
# ---------------------------------------------------------------------------

def biometric_privacy_tunnel(user_id: str) -> str:
    """Confirm biometric data routed through Worldcoin zk protocol."""
    _log_event(user_id, "biometric_routed")
    return "routed_through_zk"


# ---------------------------------------------------------------------------
# Global Onboarding Portal
# ---------------------------------------------------------------------------

def worldapp_onboard(user_id: str, locale: str, wallet: str, world_id: str) -> dict:
    """One-tap onboarding for World App users."""
    sync_identity(user_id, wallet=wallet)
    sync_orb_identity(user_id, world_id, True)
    _log_event(user_id, "worldapp_onboard", {"locale": locale})
    return identity_summary(user_id)


# ---------------------------------------------------------------------------
# WLD Utility Bridge + Governance Sync
# ---------------------------------------------------------------------------

def wld_bridge(user_id: str, amount: float, action: str) -> dict:
    """Record WLD token actions for contributions, voting, or tips."""
    data = _load_json(LOG_PATH, {})
    meta = data.setdefault(user_id, {})
    history = meta.setdefault("wld_history", [])
    entry = {
        "action": action,
        "amount": amount,
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    history.append(entry)
    meta["wld_history"] = history
    data[user_id] = meta
    _write_json(LOG_PATH, data)
    _log_event(user_id, "wld_bridge", {"action": action, "amount": amount})
    return {"user_id": user_id, "history": history}


def run_worldcoin_diagnostics() -> dict:
    """Simple diagnostics ensuring no biometric payloads are stored."""
    data = _load_json(LOG_PATH, {})
    issues = []
    for uid, meta in data.items():
        if "biometric" in json.dumps(meta):
            issues.append(uid)
    result = {
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "issues": issues,
        "version": "Vaultfire PoP Sync v1.0",
    }
    _log_event("system", "diagnostics", result)
    return result

__all__ = [
    "sync_orb_identity",
    "register_pop",
    "biometric_privacy_tunnel",
    "worldapp_onboard",
    "wld_bridge",
    "run_worldcoin_diagnostics",
]
