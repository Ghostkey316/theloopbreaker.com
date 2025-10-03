"""Purposeful scale protocol safeguards."""
from __future__ import annotations

import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Sequence, Set, Tuple

from utils.json_io import load_json, write_json

from .alignment_guard import evaluate_alignment

BASE_DIR = Path(__file__).resolve().parents[1]
PURPOSE_PROFILES_PATH = BASE_DIR / "logs" / "purpose_profiles.json"
SCALE_LOG_PATH = BASE_DIR / "logs" / "purposeful_scale_log.json"
PURPOSE_INDEX_PATH = BASE_DIR / "logs" / "purpose_recall_index.json"

DEFAULT_BELIEF_THRESHOLD = 0.64
RECOGNIZED_MISSION_THREADS = {"vaultfire", "ns3", "ghostkey-316"}
MAX_INDEX_HISTORY = 25
DEFAULT_BOOTSTRAP_TRAITS = ["stewardship", "integrity", "coherence"]
DEFAULT_BOOTSTRAP_MISSION = (
    "Safeguard Vaultfire, NS3, and Ghostkey-316 mission threads with moral coherence"
)


def _safe_float(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _parse_timestamp(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        candidate = value.strip()
        if not candidate:
            return None
        candidate = candidate.replace("Z", "+00:00")
        try:
            return datetime.fromisoformat(candidate)
        except ValueError:
            return None
    return None


def _normalize_tags(tags: Iterable[Any]) -> List[str]:
    normalized: List[str] = []
    for tag in tags:
        if tag is None:
            continue
        text = str(tag).strip().lower()
        if not text:
            continue
        text = text.replace("#", "")
        if text:
            normalized.append(text)
    # preserve insertion order while removing duplicates
    seen: Set[str] = set()
    ordered: List[str] = []
    for tag in normalized:
        if tag in seen:
            continue
        ordered.append(tag)
        seen.add(tag)
    return ordered


def _tokenize(text: str) -> Set[str]:
    tokens: Set[str] = set()
    for raw in text.lower().replace("-", " ").split():
        cleaned = "".join(ch for ch in raw if ch.isalnum())
        if cleaned:
            tokens.add(cleaned)
    return tokens


def _alignment_score(reference: str, candidate: str) -> float:
    reference_tokens = _tokenize(reference)
    candidate_tokens = _tokenize(candidate)
    if not reference_tokens or not candidate_tokens:
        return 0.0
    overlap = reference_tokens & candidate_tokens
    if not overlap:
        return 0.0
    return len(overlap) / len(reference_tokens)


def _load_profile(user_id: str) -> Dict[str, Any]:
    profiles = load_json(PURPOSE_PROFILES_PATH, {})
    entry = profiles.get(user_id)
    if isinstance(entry, dict):
        return dict(entry)
    return {}


def _load_mission(user_id: str) -> str:
    entry = _load_profile(user_id)
    mission = entry.get("mission") or entry.get("declared_purpose") or ""
    if isinstance(mission, str):
        return mission.strip()
    return ""


def _node_signature(node: Mapping[str, Any]) -> str:
    payload = {
        "operation": node.get("operation"),
        "mission": node.get("mission"),
        "user_id": node.get("user_id"),
    }
    token = json.dumps(payload, sort_keys=True).encode()
    return hashlib.sha256(token).hexdigest()


def _log_scale_entry(entry: Mapping[str, Any]) -> None:
    log: List[Dict[str, Any]] = load_json(SCALE_LOG_PATH, [])
    log.append(dict(entry))
    write_json(SCALE_LOG_PATH, log)


def _merge_ordered_strings(values: Iterable[str]) -> List[str]:
    seen: Set[str] = set()
    ordered: List[str] = []
    for value in values:
        text = str(value).strip()
        if not text:
            continue
        key = text.lower()
        if key in seen:
            continue
        ordered.append(text)
        seen.add(key)
    return ordered


def _persist_mission_profile(
    user_id: str,
    mission: str,
    traits: Sequence[str] | None = None,
    *,
    source: str = "bootstrap",
) -> str:
    mission_text = str(mission or "").strip()
    if not mission_text:
        return ""

    profile = _load_profile(user_id)
    existing_traits = []
    if isinstance(profile.get("traits"), list):
        existing_traits = [
            str(item).strip()
            for item in profile["traits"]
            if isinstance(item, str) and str(item).strip()
        ]

    combined_traits = existing_traits
    if traits:
        combined_traits = _merge_ordered_strings(list(existing_traits) + list(traits))

    profile.update(
        {
            "mission": mission_text,
            "mission_source": source,
            "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        }
    )
    if combined_traits:
        profile["traits"] = combined_traits

    profiles = load_json(PURPOSE_PROFILES_PATH, {})
    profiles[user_id] = profile
    write_json(PURPOSE_PROFILES_PATH, profiles)
    return mission_text


def _coalesce_declared_purpose(
    identity: Mapping[str, Any],
    declared_purpose: Any,
) -> str:
    candidates: List[Any] = []
    if declared_purpose is not None:
        candidates.append(declared_purpose)
    for key in ("declaredPurpose", "declared_purpose", "mission", "purpose"):
        if key in identity:
            candidates.append(identity.get(key))
    for candidate in candidates:
        if isinstance(candidate, str) and candidate.strip():
            return candidate.strip()
    return ""


def _extract_traits(identity: Mapping[str, Any]) -> Tuple[List[str], str]:
    traits: List[str] = []
    for key in ("missionTraits", "traits", "strengths", "values", "pillars"):
        raw = identity.get(key)
        if isinstance(raw, str):
            for token in raw.replace(",", " ").split():
                cleaned = token.strip()
                if cleaned:
                    traits.append(cleaned)
        elif isinstance(raw, Iterable) and not isinstance(raw, (str, bytes)):
            for item in raw:
                if isinstance(item, str) and item.strip():
                    traits.append(item.strip())

    if not traits:
        normalized_tags = _normalize_tags(identity.get("missionTags", []))
        traits.extend(tag.replace("-", " ").title() for tag in normalized_tags)

    if not traits:
        declared = _coalesce_declared_purpose(identity, None)
        if declared:
            for token in _tokenize(declared):
                if len(token) >= 4:
                    traits.append(token.title())

    source = "identity"
    if not traits:
        traits = list(DEFAULT_BOOTSTRAP_TRAITS)
        source = "default"

    ordered = _merge_ordered_strings(traits)[:7]
    return ordered, source


def ensure_mission_profile(
    user_id: str,
    identity: Mapping[str, Any],
    declared_purpose: Any = None,
) -> str:
    """Guarantee that ``user_id`` has a stored mission profile."""

    mission = _load_mission(user_id)
    if mission:
        return mission

    traits, trait_source = _extract_traits(identity)
    candidate = _coalesce_declared_purpose(identity, declared_purpose)

    try:
        if traits:
            from .purpose_engine import record_traits

            record_traits(user_id, list(traits))
    except Exception:
        pass

    if candidate:
        return _persist_mission_profile(
            user_id,
            candidate,
            traits,
            source="declared-purpose",
        )

    try:
        from .purpose_engine import discover_purpose

        generated = discover_purpose(user_id, list(traits))
        if generated:
            return _persist_mission_profile(
                user_id,
                generated,
                traits,
                source="generated-purpose",
            )
    except Exception:
        pass

    return _persist_mission_profile(
        user_id,
        DEFAULT_BOOTSTRAP_MISSION,
        traits,
        source=f"bootstrap-default:{trait_source}",
    )


def get_recorded_mission(user_id: str) -> str:
    """Return the stored mission for ``user_id`` (empty if unavailable)."""
    return _load_mission(user_id)


def belief_trace(
    user_id: str,
    scale_request: Mapping[str, Any],
    *,
    threshold: float = DEFAULT_BELIEF_THRESHOLD,
    identity: Mapping[str, Any] | None = None,
) -> Dict[str, Any]:
    """Validate a scale request against recorded belief intent."""

    try:
        belief_density = float(scale_request.get("belief_density", 0.0))
    except (TypeError, ValueError):
        belief_density = 0.0

    mission_tags = _normalize_tags(scale_request.get("mission_tags", []))
    declared_purpose = str(scale_request.get("declared_purpose", "")).strip()
    profile = _load_profile(user_id)
    mission = profile.get("mission", "") if isinstance(profile.get("mission"), str) else ""
    mission = mission.strip()
    index_snapshot: Mapping[str, Sequence[Mapping[str, Any]]] = load_json(PURPOSE_INDEX_PATH, {})
    recognized_threads = {tag.lower() for tag in index_snapshot.keys()} | set(RECOGNIZED_MISSION_THREADS)

    reasons: List[str] = []
    alignment = 0.0

    if belief_density < threshold:
        reasons.append("belief density below threshold")

    if not mission:
        reasons.append("no recorded user mission")
    else:
        if declared_purpose:
            alignment = _alignment_score(mission, declared_purpose)
        else:
            declared_purpose = mission
            alignment = 1.0
        if alignment <= 0.0:
            reasons.append("declared purpose misaligned with stored mission")

    tag_set = set(mission_tags)
    if not tag_set:
        reasons.append("mission tags required for scaling")
    elif not (tag_set & RECOGNIZED_MISSION_THREADS):
        reasons.append("mission tags must include a core mission thread")
    elif not (tag_set & recognized_threads):
        reasons.append("mission tags missing required threads")

    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    approved = not reasons

    entry = {
        "user_id": user_id,
        "operation": scale_request.get("operation", "scale"),
        "belief_density": round(belief_density, 3),
        "mission_tags": mission_tags,
        "mission": mission,
        "declared_purpose": declared_purpose,
        "alignment": round(alignment, 3),
        "approved": approved,
        "reason": "; ".join(reasons) if reasons else "approved",
        "timestamp": timestamp,
    }
    guard_payload = {
        "belief_density": belief_density,
        "declared_purpose": declared_purpose,
        "mission": mission,
        "mission_tags": mission_tags,
        "alignment": alignment,
        "empathy_score": scale_request.get("empathy_score"),
        "override": scale_request.get("override"),
        "override_signature": scale_request.get("override_signature"),
        "trust_tier": scale_request.get("trust_tier"),
    }
    guard_result = evaluate_alignment(
        entry["operation"],
        guard_payload,
        identity=identity,
        override_requested=bool(scale_request.get("override")),
    )
    guard_summary = {
        "decision": guard_result["decision"],
        "reasons": guard_result["reasons"],
        "override": guard_result["override"],
        "drift": guard_result["drift"],
    }

    if not guard_result["allowed"]:
        guard_reasons = guard_result["reasons"] or ["alignment guard rejection"]
        for reason in guard_reasons:
            if reason not in reasons:
                reasons.append(reason)

    approved = not reasons and guard_result["allowed"]

    entry.update({
        "approved": approved,
        "reason": "; ".join(reasons) if reasons else "approved",
        "alignment_guard": guard_summary,
    })

    if guard_result["decision"] == "override":
        entry["override_authorized"] = True

    if profile:
        if profile.get("mission_source"):
            entry["mission_source"] = profile.get("mission_source")
        if profile.get("traits"):
            entry["traits"] = profile.get("traits")

    _log_scale_entry(entry)

    if approved:
        node = {
            "operation": entry["operation"],
            "mission": mission,
            "timestamp": timestamp,
            "user_id": user_id,
        }
        node["signature"] = _node_signature(node)
        purpose_recall_indexing(mission_tags, node)

    return {
        "approved": approved,
        "reason": entry["reason"],
        "belief_density": belief_density,
        "alignment": alignment,
        "mission_reference": mission,
        "mission_tags": mission_tags,
        "timestamp": timestamp,
        "mission_source": profile.get("mission_source") if profile else None,
        "alignment_guard": guard_summary,
    }


def behavioral_resonance_filter(
    user_id: str,
    scale_request: Mapping[str, Any],
) -> Dict[str, Any]:
    """Ensure new scale behavior resonates with prior mission history."""

    mission_tags = _normalize_tags(scale_request.get("mission_tags", []))
    declared_purpose = str(scale_request.get("declared_purpose", "")).strip()
    if not mission_tags:
        return {"allowed": False, "reason": "mission tags required for resonance"}

    log: Sequence[Mapping[str, Any]] = load_json(SCALE_LOG_PATH, [])
    history = [
        entry
        for entry in log
        if entry.get("user_id") == user_id and entry.get("approved")
    ]

    for entry in history:
        prior_tags = set(entry.get("mission_tags", []))
        if prior_tags and mission_tags and not prior_tags.intersection(mission_tags):
            return {
                "allowed": False,
                "reason": "mission tags diverge from prior approved expansions",
                "last_alignment": entry.get("mission"),
            }
        if declared_purpose and entry.get("mission"):
            if _alignment_score(entry["mission"], declared_purpose) < 0.2:
                return {
                    "allowed": False,
                    "reason": "declared purpose drifts from mission history",
                    "last_alignment": entry.get("mission"),
                }

    index: Mapping[str, Sequence[Mapping[str, Any]]] = load_json(PURPOSE_INDEX_PATH, {})
    for tag in mission_tags:
        nodes = index.get(tag, [])
        for node in nodes:
            if node.get("user_id") and node["user_id"] != user_id:
                continue
            mission = node.get("mission", "")
            if declared_purpose and mission:
                if _alignment_score(mission, declared_purpose) < 0.2:
                    return {
                        "allowed": False,
                        "reason": f"purpose recall mismatch on tag '{tag}'",
                        "last_alignment": mission,
                    }

    return {"allowed": True, "reason": "resonant"}


def purpose_recall_indexing(
    mission_tags: Sequence[str],
    node: Mapping[str, Any],
) -> Dict[str, List[Dict[str, Any]]]:
    """Index mission tags to scale decisions for recall checks."""

    tags = _normalize_tags(mission_tags)
    if not tags:
        return load_json(PURPOSE_INDEX_PATH, {})

    index: Dict[str, List[Dict[str, Any]]] = load_json(PURPOSE_INDEX_PATH, {})
    record = {
        "signature": node.get("signature") or _node_signature(node),
        "operation": node.get("operation"),
        "timestamp": node.get("timestamp"),
        "mission": node.get("mission"),
        "user_id": node.get("user_id"),
    }

    for tag in tags:
        bucket = list(index.get(tag, []))
        if not any(item.get("signature") == record["signature"] for item in bucket):
            bucket.append(record)
        if len(bucket) > MAX_INDEX_HISTORY:
            bucket = bucket[-MAX_INDEX_HISTORY:]
        index[tag] = bucket

    write_json(PURPOSE_INDEX_PATH, index)
    return index


def _sorted_history(entries: Sequence[Mapping[str, Any]]) -> List[Mapping[str, Any]]:
    def _sort_key(item: Mapping[str, Any]) -> Tuple[int, str]:
        ts = _parse_timestamp(item.get("timestamp"))
        if ts:
            return (0, ts.isoformat())
        return (1, str(item.get("timestamp", "")))

    return sorted(entries, key=_sort_key)


def _summarize_guard(guard: Mapping[str, Any] | Sequence[Any] | None) -> Mapping[str, Any] | None:
    if guard is None:
        return None
    if isinstance(guard, Mapping):
        summary = {k: guard[k] for k in ("outcome", "score", "version") if k in guard}
        if not summary and guard:
            # fall back to shallow copy of simple serializable values
            summary = {
                k: v
                for k, v in guard.items()
                if isinstance(v, (str, int, float, bool))
            }
        return summary or None
    if isinstance(guard, Sequence) and not isinstance(guard, (str, bytes, bytearray)):
        condensed: List[Any] = []
        for item in guard:
            if isinstance(item, Mapping):
                condensed.append(
                    {
                        k: item[k]
                        for k in ("check", "outcome", "score")
                        if k in item
                    }
                )
            else:
                condensed.append(item)
        return {"checks": condensed}
    return None


def _sanitize_decision(
    entry: Mapping[str, Any],
    *,
    redact_denials: bool,
) -> Dict[str, Any]:
    mission_tags = _merge_ordered_strings(entry.get("mission_tags", []))
    record: Dict[str, Any] = {
        "timestamp": entry.get("timestamp"),
        "operation": entry.get("operation"),
        "mission": entry.get("mission"),
        "mission_tags": mission_tags,
        "approved": bool(entry.get("approved")),
        "belief_density": _safe_float(entry.get("belief_density")),
        "alignment": _safe_float(entry.get("alignment")),
    }
    reason = entry.get("reason")
    if reason and (record["approved"] or not redact_denials):
        record["reason"] = str(reason)
    elif not record["approved"] and redact_denials:
        record["reason"] = "redacted"
    guard_summary = _summarize_guard(entry.get("alignment_guard"))
    if guard_summary:
        record["alignment_guard"] = guard_summary
    return record


def generate_attestation_pack(
    user_id: str,
    *,
    history_limit: int | None = 10,
    include_index: bool = True,
    redact_denials: bool = False,
) -> Dict[str, Any]:
    """Compile an auditable attestation pack for a guardian."""

    user_key = str(user_id or "").strip()
    if not user_key:
        raise ValueError("user_id is required for attestation generation")

    profile = _load_profile(user_key)
    mission = str(profile.get("mission") or _load_mission(user_key)).strip()
    traits = profile.get("traits") if isinstance(profile.get("traits"), Sequence) else []
    mission_source = profile.get("mission_source") if isinstance(profile.get("mission_source"), str) else None

    log: Sequence[Mapping[str, Any]] = load_json(SCALE_LOG_PATH, [])
    history = [entry for entry in log if entry.get("user_id") == user_key]
    history = _sorted_history(history)
    if history_limit is not None and history_limit >= 0:
        history = history[-history_limit or None :]

    sanitized = [_sanitize_decision(entry, redact_denials=redact_denials) for entry in history]
    approved = [entry for entry in sanitized if entry.get("approved")]
    denied = [entry for entry in sanitized if not entry.get("approved")]
    belief_values = [entry.get("belief_density", 0.0) for entry in sanitized if entry.get("belief_density")]
    approved_belief = [entry.get("belief_density", 0.0) for entry in approved if entry.get("belief_density")]

    def _avg(values: Sequence[float]) -> float:
        return round(sum(values) / len(values), 4) if values else 0.0

    stats = {
        "total": len(sanitized),
        "approved": len(approved),
        "denied": len(denied),
        "approval_rate": round(len(approved) / len(sanitized), 4) if sanitized else 0.0,
        "belief_density_avg": _avg(belief_values),
        "belief_density_approved_avg": _avg(approved_belief),
    }

    attestation = {
        "user_id": user_key,
        "generated_at": datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
        "mission_profile": {
            "mission": mission,
            "traits": list(traits) if traits else [],
            "mission_source": mission_source,
        },
        "decision_stats": stats,
        "decision_history": sanitized,
    }

    if include_index:
        tag_index: Dict[str, List[Dict[str, Any]]] = {}
        index = load_json(PURPOSE_INDEX_PATH, {})
        relevant_tags = {
            tag
            for entry in sanitized
            for tag in entry.get("mission_tags", [])
            if tag
        }
        for tag in sorted(relevant_tags):
            nodes = [dict(node) for node in index.get(tag, [])]
            if history_limit and history_limit > 0:
                nodes = nodes[-history_limit:]
            tag_index[tag] = nodes
        attestation["mission_recall_snapshot"] = tag_index

    digest_payload = {
        "user_id": attestation["user_id"],
        "generated_at": attestation["generated_at"],
        "stats": stats,
        "history": sanitized,
    }
    token = json.dumps(digest_payload, sort_keys=True, default=str).encode()
    attestation["attestation_hash"] = hashlib.sha256(token).hexdigest()

    return attestation


__all__ = [
    "belief_trace",
    "behavioral_resonance_filter",
    "purpose_recall_indexing",
    "get_recorded_mission",
    "DEFAULT_BELIEF_THRESHOLD",
    "ensure_mission_profile",
    "generate_attestation_pack",
]
