"""Codex manifest snapshot utility."""
from __future__ import annotations

import json
import hashlib
from pathlib import Path
from typing import Any, Dict, List

BASE_DIR = Path(__file__).resolve().parent
SNAPSHOT_PATH = BASE_DIR / "dashboards" / "protocol_snapshot.json"


def snapshot_protocol(
    version: str,
    description: str,
    modules: List[str],
    test_status: Dict[str, Any],
    forks_enabled: bool,
    partner_mode: bool,
    ghostkey_id: str,
    wallet: str,
    timestamp: str,
) -> Dict[str, Any]:
    """Write a protocol snapshot and return the data."""
    snapshot = {
        "version": version,
        "description": description,
        "modules": modules,
        "test_status": test_status,
        "forks_enabled": forks_enabled,
        "partner_mode": partner_mode,
        "ghostkey_id": ghostkey_id,
        "wallet": wallet,
        "timestamp": timestamp,
    }
    checksum_src = json.dumps(snapshot, sort_keys=True).encode()
    snapshot["checksum"] = hashlib.sha256(checksum_src).hexdigest()
    SNAPSHOT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(SNAPSHOT_PATH, "w") as f:
        json.dump(snapshot, f, indent=2)
    return snapshot

__all__ = ["snapshot_protocol"]
