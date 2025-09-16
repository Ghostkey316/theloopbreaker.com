"""Satellite fork deployment utilities.

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
from vaultfire._purposeful_scale import authorize_scale

BASE_DIR = Path(__file__).resolve().parent.parent
LOG_PATH = BASE_DIR / "logs" / "satellite_lite_fork.log"


def deploy_lite_fork(
    identity: Dict[str, Any],
    restrictAdminAccess: bool = False,
    allowReferral: bool = False,
    passiveTracking: bool = False,
) -> Dict[str, Any]:
    """Log deployment of a lite satellite fork."""
    entry = {
        "wallet": identity.get("wallet"),
        "restrict_admin": restrictAdminAccess,
        "allow_referral": allowReferral,
        "passive_tracking": passiveTracking,
        "timestamp": datetime.utcnow().isoformat(),
    }
    authorized, reason, request, trace = authorize_scale(
        identity,
        "satellite.deploy_lite_fork",
        extra_tags=["satellite", "expansion"],
    )
    entry.update(
        {
            "mission_tags": request["mission_tags"],
            "declared_purpose": request["declared_purpose"],
            "belief_density": round(request["belief_density"], 3),
            "scale_authorized": authorized,
            "mission_reference": trace.get("mission_reference"),
            "mission_source": trace.get("mission_source"),
        }
    )
    if not authorized:
        if reason:
            entry["blocked_reason"] = reason
        return entry

    log = load_json(LOG_PATH, [])
    log.append(entry)
    write_json(LOG_PATH, log)
    return entry
