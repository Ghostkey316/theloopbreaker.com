"""Shared helpers for enforcing the Purposeful Scale protocol."""
from __future__ import annotations

from typing import Any, Dict, List, Sequence, Tuple

from engine.purposeful_scale import (
    behavioral_resonance_filter,
    belief_trace,
    ensure_mission_profile,
    get_recorded_mission,
)

DEFAULT_MISSION_TAGS = ["vaultfire", "ns3", "ghostkey-316"]


def _resolve_user(identity: Dict[str, Any]) -> str:
    for key in ("ens", "user_id", "wallet"):
        value = identity.get(key)
        if isinstance(value, str) and value.strip():
            return value
    return "anonymous"


def _resolve_belief_density(identity: Dict[str, Any]) -> float:
    density = identity.get("beliefDensity")
    if density is None:
        density = 0.72 if identity.get("ethicsVerified") else 0.5
    try:
        return float(density)
    except (TypeError, ValueError):
        return 0.0


def _resolve_declared_purpose(identity: Dict[str, Any], user_id: str) -> str:
    purpose = identity.get("declaredPurpose") or identity.get("mission") or identity.get("purpose")
    if isinstance(purpose, str) and purpose.strip():
        return purpose.strip()
    return get_recorded_mission(user_id)


def build_scale_request(
    identity: Dict[str, Any],
    operation: str,
    extra_tags: Sequence[str] | None = None,
) -> Tuple[str, Dict[str, Any]]:
    mission_tags: List[str] = []
    for tag in identity.get("missionTags", []):
        if isinstance(tag, str) and tag.strip():
            mission_tags.append(tag)
    if extra_tags:
        mission_tags.extend(extra_tags)
    if not mission_tags:
        mission_tags.extend(DEFAULT_MISSION_TAGS)

    user_id = _resolve_user(identity)
    request: Dict[str, Any] = {
        "operation": operation,
        "mission_tags": mission_tags,
        "declared_purpose": _resolve_declared_purpose(identity, user_id),
        "belief_density": _resolve_belief_density(identity),
    }
    mission_reference = ensure_mission_profile(user_id, identity, request["declared_purpose"])
    if not request["declared_purpose"] and mission_reference:
        request["declared_purpose"] = mission_reference
    return user_id, request


def authorize_scale(
    identity: Dict[str, Any],
    operation: str,
    extra_tags: Sequence[str] | None = None,
) -> Tuple[bool, str | None, Dict[str, Any], Dict[str, Any]]:
    user_id, request = build_scale_request(identity, operation, extra_tags)
    trace = belief_trace(user_id, request)
    if not trace["approved"]:
        return False, trace["reason"], request, trace
    resonance = behavioral_resonance_filter(user_id, request)
    if not resonance["allowed"]:
        return False, resonance["reason"], request, trace
    return True, None, request, trace


__all__ = ["authorize_scale", "build_scale_request", "DEFAULT_MISSION_TAGS"]
