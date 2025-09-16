"""Vaultfire Law 6: Moral Alignment Synchronizer."""
from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Mapping, Sequence

from utils.json_io import load_json, write_json

BASE_DIR = Path(__file__).resolve().parents[1]
BELIEF_TRACE_LOG_PATH = BASE_DIR / "logs" / "belief_trace_log.json"
DEFAULT_BELIEF_FLOOR = 0.6
DEFAULT_EMPATHY_THRESHOLD = 0.58
HUMANITY_TOKENS = {
    "advance",
    "care",
    "community",
    "empathy",
    "guard",
    "guardian",
    "guardians",
    "guide",
    "human",
    "humanity",
    "integrity",
    "protect",
    "safeguard",
    "steward",
    "stewardship",
    "support",
    "sustain",
    "uplift",
    "vaultfire",
    "ns3",
    "ghostkey",
    "ghostkey-316",
    "purpose",
}
FORBIDDEN_TOKENS = {
    "abuse",
    "coerce",
    "dominate",
    "erase",
    "exploit",
    "harm",
    "harvest",
    "manipulate",
    "oppress",
    "purge",
    "subjugate",
    "surveil",
    "surveillance",
    "weapon",
    "weaponize",
}
OVERRIDE_TRUST_TIERS = {"guardian", "architect", "trusted", "ethics-lead"}


def _coerce_float(value: Any, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _extract_text(payload: Mapping[str, Any], *keys: str) -> str:
    for key in keys:
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _collect_tags(payload: Mapping[str, Any]) -> set[str]:
    tags: set[str] = set()
    for key in ("mission_tags", "missionTags", "tags", "labels", "goal_tags", "memory_tags"):
        value = payload.get(key)
        if isinstance(value, Sequence) and not isinstance(value, (str, bytes)):
            for item in value:
                if isinstance(item, str) and item.strip():
                    tags.add(item.strip().lower())
        elif isinstance(value, str) and value.strip():
            tags.add(value.strip().lower())
    return tags


def _tokenize(text: str) -> set[str]:
    tokens: set[str] = set()
    for raw in text.lower().replace("-", " ").split():
        cleaned = "".join(ch for ch in raw if ch.isalnum())
        if cleaned:
            tokens.add(cleaned)
    return tokens


def _identity_tag(identity: Mapping[str, Any] | None) -> str | None:
    if not identity:
        return None
    for key in ("ens", "user_id", "wallet", "id", "address", "participant"):
        value = identity.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _append_audit_log(record: Mapping[str, Any]) -> None:
    log: list[Dict[str, Any]] = load_json(BELIEF_TRACE_LOG_PATH, [])
    log.append(dict(record))
    write_json(BELIEF_TRACE_LOG_PATH, log)


def evaluate_alignment(
    operation: str,
    payload: Mapping[str, Any],
    identity: Mapping[str, Any] | None = None,
    *,
    override_requested: bool = False,
) -> Dict[str, Any]:
    """Evaluate ``operation`` context against the Vaultfire ethics framework."""

    payload_dict = dict(payload)
    belief_density = _coerce_float(
        payload_dict.get("belief_density")
        or payload_dict.get("beliefDensity"),
        DEFAULT_BELIEF_FLOOR,
    )
    empathy_score = _coerce_float(
        payload_dict.get("empathy_score")
        or payload_dict.get("empathyScore")
        or (identity.get("empathy_score") if identity else None)
        or (identity.get("empathyScore") if identity else None),
        0.7,
    )
    mission_text = _extract_text(
        payload_dict,
        "mission",
        "declared_purpose",
        "declaredPurpose",
        "purpose",
    )
    if not mission_text and identity:
        mission_text = _extract_text(identity, "mission", "purpose")
    intent_text = _extract_text(payload_dict, "intent", "justification")

    combined_text = " ".join(filter(None, [mission_text, intent_text]))
    tokens = _tokenize(combined_text)
    tags = _collect_tags(payload_dict)

    reasons: list[str] = []
    if belief_density < DEFAULT_BELIEF_FLOOR:
        reasons.append("belief density below moral floor")
    if empathy_score < DEFAULT_EMPATHY_THRESHOLD:
        reasons.append("empathy threshold breached")

    if tokens & FORBIDDEN_TOKENS or tags & FORBIDDEN_TOKENS or "rogue" in tags:
        reasons.append("mission conflicts with empathy covenant")

    if mission_text:
        if not (tokens & HUMANITY_TOKENS or tags & HUMANITY_TOKENS):
            reasons.append("mission lacks human-first focus")
    else:
        reasons.append("mission clarity required for human-first execution")

    decision = "allow"
    allowed = True
    if reasons:
        allowed = False
        decision = "delay"
        if any(
            phrase in reason
            for reason in reasons
            for phrase in ("breached", "conflicts", "forbidden", "harm")
        ):
            decision = "block"

    identity_mapping: Dict[str, Any] = dict(identity) if identity else {}
    override_flag = bool(payload_dict.get("override")) or bool(identity_mapping.get("override"))
    if override_requested:
        override_flag = True
    signature = (
        payload_dict.get("override_signature")
        or payload_dict.get("belief_signature")
        or identity_mapping.get("beliefSignature")
        or identity_mapping.get("belief_signature")
    )
    if not signature and payload_dict.get("beliefSignatureVerified"):
        signature = payload_dict.get("beliefSignatureVerified")
    trust_tier_value = (
        payload_dict.get("trust_tier")
        or payload_dict.get("trustTier")
        or identity_mapping.get("trust_tier")
        or identity_mapping.get("trustTier")
        or identity_mapping.get("role")
        or identity_mapping.get("tier")
    )
    trust_tier = str(trust_tier_value).strip().lower() if trust_tier_value else ""
    signature_valid = isinstance(signature, str) and len(signature.strip()) >= 8
    override_granted = False
    if not allowed and override_flag and signature_valid and trust_tier in OVERRIDE_TRUST_TIERS:
        allowed = True
        decision = "override"
        override_granted = True

    drift = bool(reasons)
    audit_record = {
        "operation": operation,
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "identity": _identity_tag(identity_mapping),
        "allowed": allowed,
        "decision": decision,
        "reasons": reasons or ["cleared"],
        "belief_density": round(belief_density, 3),
        "empathy_score": round(empathy_score, 3),
        "override": override_granted,
        "drift_flag": drift,
    }
    if trust_tier:
        audit_record["trust_tier"] = trust_tier
    if override_flag and not override_granted:
        audit_record["override_denied"] = True

    _append_audit_log(audit_record)

    return {
        "allowed": allowed,
        "decision": decision,
        "reasons": list(reasons),
        "override": override_granted,
        "drift": drift,
        "audit_record": audit_record,
        "inputs": {
            "belief_density": belief_density,
            "empathy_score": empathy_score,
            "trust_tier": trust_tier,
        },
    }


__all__ = [
    "evaluate_alignment",
    "BELIEF_TRACE_LOG_PATH",
    "DEFAULT_BELIEF_FLOOR",
    "DEFAULT_EMPATHY_THRESHOLD",
]
