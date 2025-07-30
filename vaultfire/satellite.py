"""Satellite fork deployment utilities.

DISCLAIMER:
- Use at your own risk; uptime or results are not guaranteed.
- Ambient data is logged only with opt-in consent.
- Nothing here constitutes legal, medical, or financial advice.
"""

from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict

BASE_DIR = Path(__file__).resolve().parent.parent
LOG_PATH = BASE_DIR / "logs" / "satellite_lite_fork.log"


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


def deploy_lite_fork(
    identity: Dict[str, Any],
    restrictAdminAccess: bool = False,
    allowReferral: bool = False,
    passiveTracking: bool = False,
) -> Dict[str, Any]:
    """Log deployment of a lite satellite fork."""
    log = _load_json(LOG_PATH, [])
    entry = {
        "wallet": identity.get("wallet"),
        "restrict_admin": restrictAdminAccess,
        "allow_referral": allowReferral,
        "passive_tracking": passiveTracking,
        "timestamp": datetime.utcnow().isoformat(),
    }
    log.append(entry)
    _write_json(LOG_PATH, log)
    return entry
