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
from vaultfire._purposeful_scale import authorize_scale

BASE_DIR = Path(__file__).resolve().parent.parent
STATUS_PATH = BASE_DIR / "vaultfire-core" / "companion_echo_status.json"
LOG_PATH = BASE_DIR / "logs" / "companion_echo.log"


def deploy_companion(identity: Dict[str, Any]) -> Dict[str, Any]:
    """Record companion deployment using ``identity`` info."""

    entry: Dict[str, Any] = {
        "wallet": identity.get("wallet"),
        "ens": identity.get("ens"),
        "timestamp": datetime.utcnow().isoformat(),
    }

    authorized, reason, request, trace = authorize_scale(
        identity,
        "echo.deploy_companion",
        extra_tags=["echo", "companion", "expansion"],
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
    guard_decision = trace.get("alignment_guard")
    if guard_decision:
        entry["alignment_guard"] = guard_decision
    if not authorized and reason:
        entry["blocked_reason"] = reason
    if not authorized and guard_decision and guard_decision.get("reasons"):
        entry.setdefault("blocked_reason", "; ".join(guard_decision["reasons"]))

    log = load_json(LOG_PATH, [])
    log.append(entry)
    write_json(LOG_PATH, log)

    if not authorized:
        return entry

    state = load_json(STATUS_PATH, {"deployments": []})
    deployments = list(state.get("deployments", []))
    companion_record = {
        "wallet": entry.get("wallet"),
        "ens": entry.get("ens"),
        "timestamp": entry.get("timestamp"),
        "mission_tags": entry.get("mission_tags"),
        "mission_reference": entry.get("mission_reference"),
    }
    deployments.append(companion_record)
    state["deployments"] = deployments
    write_json(STATUS_PATH, state)

    return entry
