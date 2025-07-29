"""Companion echo layer deployment utilities.

- Ambient data gathering requires opt-in consent from participants.
- Nothing here constitutes financial or medical advice.
"""

from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict

BASE_DIR = Path(__file__).resolve().parent.parent
STATUS_PATH = BASE_DIR / "vaultfire-core" / "companion_echo_status.json"
LOG_PATH = BASE_DIR / "logs" / "companion_echo.log"


def _load_json(path: Path, default: Any) -> Any:
    if path.exists():
        try:
            with open(path) as f:
                return json.load(f)
        except json.JSONDecodeError:
            return default
    return default


def _write_json(path: Path, data: Any) -> None:
    os.makedirs(path.parent, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def deploy_companion(identity: Dict[str, Any]) -> Dict[str, Any]:
    """Record companion deployment using ``identity`` info."""
    state = _load_json(STATUS_PATH, {"deployments": []})
    entry = {
        "wallet": identity.get("wallet"),
        "ens": identity.get("ens"),
        "timestamp": datetime.utcnow().isoformat(),
    }
    state["deployments"].append(entry)
    _write_json(STATUS_PATH, state)

    log = _load_json(LOG_PATH, [])
    log.append(entry)
    _write_json(LOG_PATH, log)
    return entry
