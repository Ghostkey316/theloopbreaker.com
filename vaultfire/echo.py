"""Companion echo layer deployment utilities.

DISCLAIMER:
- Use at your own risk; uptime or results are not guaranteed.
- Ambient data is logged only with opt-in consent.
- Nothing here constitutes legal, medical, or financial advice.
"""

from __future__ import annotations
from datetime import datetime
from pathlib import Path
from typing import Any, Dict

from utils.json_io import load_json, write_json

BASE_DIR = Path(__file__).resolve().parent.parent
STATUS_PATH = BASE_DIR / "vaultfire-core" / "companion_echo_status.json"
LOG_PATH = BASE_DIR / "logs" / "companion_echo.log"


def deploy_companion(identity: Dict[str, Any]) -> Dict[str, Any]:
    """Record companion deployment using ``identity`` info."""
    state = load_json(STATUS_PATH, {"deployments": []})
    entry = {
        "wallet": identity.get("wallet"),
        "ens": identity.get("ens"),
        "timestamp": datetime.utcnow().isoformat(),
    }
    state["deployments"].append(entry)
    write_json(STATUS_PATH, state)

    log = load_json(LOG_PATH, [])
    log.append(entry)
    write_json(LOG_PATH, log)
    return entry
