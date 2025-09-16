"""Purposeful scale protocol safeguards."""
from __future__ import annotations

import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Sequence, Set

from utils.json_io import load_json, write_json

BASE_DIR = Path(__file__).resolve().parents[1]
PURPOSE_PROFILES_PATH = BASE_DIR / "logs" / "purpose_profiles.json"
SCALE_LOG_PATH = BASE_DIR / "logs" / "purposeful_scale_log.json"
PURPOSE_INDEX_PATH = BASE_DIR / "logs" / "purpose_recall_index.json"

DEFAULT_BELIEF_THRESHOLD = 0.64
RECOGNIZED_MISSION_THREADS = {"vaultfire", "ns3", "ghostkey-316"}
MAX_INDEX_HISTORY = 25


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


def _load_mission(user_id: str) -> str:
    profiles = load_json(PURPOSE_PROFILES_PATH, {})
    entry = profiles.get(user_id) or {}
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


def get_recorded_mission(user_id: str) -> str:
    """Return the stored mission for ``user_id`` (empty if unavailable)."""
    return _load_mission(user_id)


def belief_trace(
    user_id: str,
    scale_request: Mapping[str, Any],
    *,
    threshold: float = DEFAULT_BELIEF_THRESHOLD,
) -> Dict[str, Any]:
    """Validate a scale request against recorded belief intent."""

    try:
        belief_density = float(scale_request.get("belief_density", 0.0))
    except (TypeError, ValueError):
        belief_density = 0.0

    mission_tags = _normalize_tags(scale_request.get("mission_tags", []))
    declared_purpose = str(scale_request.get("declared_purpose", "")).strip()
    mission = _load_mission(user_id)
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


__all__ = [
    "belief_trace",
    "behavioral_resonance_filter",
    "purpose_recall_indexing",
    "get_recorded_mission",
    "DEFAULT_BELIEF_THRESHOLD",
]
