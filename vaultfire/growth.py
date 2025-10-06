"""Growth fork preparation helpers.

DISCLAIMER:
- Use at your own risk; uptime or results are not guaranteed.
- Ambient data is logged only with opt-in consent.
- Nothing here constitutes legal, medical, or financial advice.
"""

from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List

from signal_log import log_signal
from utils.json_io import load_json, write_json
from vaultfire._purposeful_scale import authorize_scale

BASE_DIR = Path(__file__).resolve().parent.parent
LOG_PATH = BASE_DIR / "logs" / "growth_prepare_v26.log"
QUANTUM_LOOP_LOG_ENV = "VAULTFIRE_QUANTUM_LOOP_LOG_PATH"
QUANTUM_LOOP_DEFAULT_LOG = BASE_DIR / "logs" / "quantum_loop_activations.json"


def _ensure_text(name: str, value: Any) -> str:
    if not isinstance(value, str):
        raise TypeError(f"{name} must be a string")
    trimmed = value.strip()
    if not trimmed:
        raise ValueError(f"{name} cannot be empty")
    return trimmed


def _normalize_roles(anchor_roles: Iterable[str]) -> List[str]:
    if isinstance(anchor_roles, str):
        roles_iter: Iterable[str] = [anchor_roles]
    else:
        roles_iter = anchor_roles

    try:
        roles_list = list(roles_iter)
    except TypeError as exc:  # pragma: no cover - defensive guard
        raise TypeError("anchor_roles must be an iterable of strings") from exc

    normalized: List[str] = []
    for index, role in enumerate(roles_list):
        name = f"anchor_roles[{index}]"
        normalized_role = _ensure_text(name, role)
        if normalized_role not in normalized:
            normalized.append(normalized_role)

    if not normalized:
        raise ValueError("anchor_roles must contain at least one role")
    return normalized


def _quantum_loop_log_path() -> Path:
    custom = os.getenv(QUANTUM_LOOP_LOG_ENV)
    if custom:
        return Path(custom)
    return QUANTUM_LOOP_DEFAULT_LOG


def prepare_v26(
    identity: Dict[str, Any],
    enableMultipliers: bool = False,
    enableOpenAISync: bool = False,
    yieldRewards: bool = False,
) -> Dict[str, Any]:
    """Log preparation of the V26 growth fork."""
    entry = {
        "wallet": identity.get("wallet"),
        "multipliers": enableMultipliers,
        "openai_sync": enableOpenAISync,
        "yield_rewards": yieldRewards,
        "timestamp": datetime.utcnow().isoformat(),
    }
    authorized, reason, request, trace = authorize_scale(
        identity,
        "growth.prepare_v26",
        extra_tags=["growth", "expansion"],
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
    if not authorized:
        if reason:
            entry["blocked_reason"] = reason
        if guard_decision and guard_decision.get("reasons") and "blocked_reason" not in entry:
            entry["blocked_reason"] = "; ".join(guard_decision["reasons"])
        return entry

    log = load_json(LOG_PATH, [])
    log.append(entry)
    write_json(LOG_PATH, log)
    return entry


def activate_quantum_loop(
    *,
    user: str,
    reinforcement_type: str,
    upgrade_schedule: str,
    validation_method: str,
    anchor_roles: Iterable[str],
    loop_visibility: str,
) -> Dict[str, Any]:
    """Register a belief-weighted quantum loop activation.

    The activation metadata is appended to a JSON log so downstream systems can
    reconcile the requested reinforcement loops. A lightweight signal event is
    also emitted to keep observability hooks aware of the activation.
    """

    normalized_user = _ensure_text("user", user)
    normalized_reinforcement = _ensure_text("reinforcement_type", reinforcement_type)
    normalized_upgrade = _ensure_text("upgrade_schedule", upgrade_schedule)
    normalized_validation = _ensure_text("validation_method", validation_method)
    normalized_visibility = _ensure_text("loop_visibility", loop_visibility)
    normalized_roles = _normalize_roles(anchor_roles)

    timestamp = datetime.utcnow().isoformat()
    entry = {
        "user": normalized_user,
        "reinforcement_type": normalized_reinforcement,
        "upgrade_schedule": normalized_upgrade,
        "validation_method": normalized_validation,
        "anchor_roles": normalized_roles,
        "loop_visibility": normalized_visibility,
        "status": "pending-verification",
        "verification": {
            "method": normalized_validation,
            "state": "pending",
        },
        "created_at": timestamp,
    }

    log_path = _quantum_loop_log_path()
    log = load_json(log_path, [])
    if not isinstance(log, list):
        log = []
    log.append(entry)
    write_json(log_path, log)

    try:
        log_signal(
            "quantum-loop.activation",
            {
                "user": normalized_user,
                "reinforcement_type": normalized_reinforcement,
                "upgrade_schedule": normalized_upgrade,
                "validation_method": normalized_validation,
                "anchor_roles": normalized_roles,
                "loop_visibility": normalized_visibility,
                "status": entry["status"],
            },
        )
    except Exception:
        # Signal logging is non-critical and should never block activations.
        pass

    return entry


__all__ = ["prepare_v26", "activate_quantum_loop"]
