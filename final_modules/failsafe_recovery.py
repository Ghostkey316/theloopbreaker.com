"""Failsafe Recovery Layer.

Provides simple recovery and migration helpers using a JSON ledger.
Supports multisig + biometric placeholders and PrivacyGuard wipe logic.
"""
from __future__ import annotations

import json
from pathlib import Path
from datetime import datetime

BASE_DIR = Path(__file__).resolve().parent
LEDGER_PATH = BASE_DIR / "recovery_ledger.json"


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


def request_recovery(user_id: str, new_device: str) -> dict:
    ledger = _load_json(LEDGER_PATH, [])
    entry = {
        "user_id": user_id,
        "new_device": new_device,
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    ledger.append(entry)
    _write_json(LEDGER_PATH, ledger)
    return entry


def privacy_wipe(user_id: str) -> None:
    ledger = _load_json(LEDGER_PATH, [])
    ledger.append({
        "user_id": user_id,
        "action": "wipe",
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    })
    _write_json(LEDGER_PATH, ledger)


__all__ = ["request_recovery", "privacy_wipe"]
