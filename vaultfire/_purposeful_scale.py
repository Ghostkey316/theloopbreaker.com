"""Shared helpers for enforcing the Purposeful Scale protocol."""
from __future__ import annotations

from typing import Any, Dict, List, Sequence, Tuple

from engine.human_standard_guard import DEFAULT_HUMAN_STANDARD_GUARD
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


def _resolve_empathy(identity: Dict[str, Any]) -> float:
    empathy = (
        identity.get("empathyScore")
        or identity.get("empathy_score")
        or identity.get("careIndex")
    )
    baseline = DEFAULT_HUMAN_STANDARD_GUARD.empathy_threshold
    explicit = empathy is not None
    if empathy is None:
        empathy = baseline + 0.05 if identity.get("ethicsVerified") else baseline
    try:
        score = float(empathy)
    except (TypeError, ValueError):
        score = baseline
    if explicit:
        return score
    return max(score, baseline)


def _resolve_override(identity: Dict[str, Any]) -> Tuple[bool, str | None, str | None]:
    override_flag = bool(
        identity.get("alignmentOverride")
        or identity.get("overrideAlignment")
        or identity.get("override")
    )
    signature = identity.get("beliefSignature") or identity.get("belief_signature")
    trust_tier = (
        identity.get("trustTier")
        or identity.get("trust_tier")
        or identity.get("role")
        or identity.get("tier")
    )
    trust_value = str(trust_tier).strip() if isinstance(trust_tier, str) else None
    return override_flag, signature if isinstance(signature, str) else None, trust_value


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
        "empathy_score": _resolve_empathy(identity),
    }
    override_flag, signature, trust_tier = _resolve_override(identity)
    if override_flag:
        request["override"] = True
    if signature:
        request["override_signature"] = signature
    if trust_tier:
        request["trust_tier"] = trust_tier
    if identity.get("beliefSignatureVerified") or identity.get("belief_signature_verified"):
        request["beliefSignatureVerified"] = True
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
    trace = belief_trace(user_id, request, identity=identity)
    if not trace["approved"]:
        return False, trace["reason"], request, trace
    resonance = behavioral_resonance_filter(user_id, request)
    if not resonance["allowed"]:
        return False, resonance["reason"], request, trace
    return True, None, request, trace


__all__ = ["authorize_scale", "build_scale_request", "DEFAULT_MISSION_TAGS"]
