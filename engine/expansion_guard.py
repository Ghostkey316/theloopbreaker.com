"""Vaultfire Second Law expansion guardrails."""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Set, Tuple


BASE_DIR = Path(__file__).resolve().parents[1]
OVERRIDE_PATH = BASE_DIR / "vaultfire-core" / "ethics" / "override_consensus.json"
PRESERVATION_PATH = BASE_DIR / "vaultfire-core" / "ethics" / "preservation_triggers.json"

DEFAULT_CONFIG: Dict[str, Any] = {
    "ethics_score_threshold": 75,
    "belief_origins": ["belief", "belief-aligned", "loyalty"],
    "preserve_users": [],
    "structure_preserve": [],
    "human_flags": [],
    "history_limit": 50,
}


def _load_json(path: Path, default: Any) -> Any:
    if path.exists():
        try:
            with open(path) as handle:
                return json.load(handle)
        except json.JSONDecodeError:
            return default
    return default


def _write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as handle:
        json.dump(data, handle, indent=2)


def _record_key(record: Dict[str, Any]) -> str:
    try:
        return json.dumps(record, sort_keys=True, default=str)
    except TypeError:
        return str(id(record))


def _score_from_record(record: Dict[str, Any]) -> Optional[float]:
    for key in ("ethics_score", "alignment", "score", "belief_score", "trust_behavior"):
        value = record.get(key)
        if isinstance(value, (int, float)):
            return float(value)
    return None


def _iterable_to_tags(values: Optional[Sequence[Any]]) -> Set[str]:
    tags: Set[str] = set()
    if values is None:
        return tags
    for item in values:
        if item is None:
            continue
        tags.add(str(item).lower())
    return tags


def _tags_from_record(record: Dict[str, Any]) -> Set[str]:
    tags: Set[str] = set()
    for key in ("origin", "source", "channel"):
        value = record.get(key)
        if isinstance(value, str) and value:
            tags.add(value.lower())
    for key in ("tags", "labels"):
        tags |= _iterable_to_tags(record.get(key))
    if record.get("belief_aligned"):
        tags.add("belief-aligned")
    if record.get("verified"):
        tags.add("belief-aligned")
    return tags


def _has_human_flag(record: Dict[str, Any], flags: Set[str]) -> bool:
    if not flags:
        return False
    tags = _tags_from_record(record)
    for flag in flags:
        lowered = flag.lower()
        if lowered in tags:
            return True
        if bool(record.get(flag)) or bool(record.get(lowered)):
            return True
    return False


def _should_preserve_record(
    record: Dict[str, Any],
    threshold: float,
    belief_origins: Set[str],
    human_flags: Set[str],
    structure_key: str,
    manual_structures: Set[str],
    user_id: Optional[str],
    manual_users: Set[str],
) -> bool:
    score = _score_from_record(record)
    if score is not None and score >= threshold:
        return True
    if _tags_from_record(record) & belief_origins:
        return True
    if _has_human_flag(record, human_flags):
        return True
    if structure_key in manual_structures:
        return True
    if user_id and user_id.lower() in manual_users:
        return True
    return False


def _should_trigger_lock(
    entry: Dict[str, Any],
    threshold: float,
    belief_origins: Set[str],
    manual_users: Set[str],
    user_id: Optional[str],
) -> bool:
    score = _score_from_record(entry)
    if score is not None and score >= threshold:
        return True
    if _tags_from_record(entry) & belief_origins:
        return True
    if user_id and user_id.lower() in manual_users:
        return True
    return False


def _activate_override_lock(
    structure: str,
    user_id: Optional[str],
    entry: Dict[str, Any],
    tags: Set[str],
    score: Optional[float],
) -> None:
    override = _load_json(OVERRIDE_PATH, {"asi_override": False})
    lock_info = override.get("second_law_lock", {})

    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    history: List[Dict[str, Any]] = list(lock_info.get("history", []))
    event: Dict[str, Any] = {
        "timestamp": timestamp,
        "structure": structure,
        "user_id": user_id,
        "tags": sorted(tags),
    }
    if score is not None:
        event["ethics_score"] = score
    text = entry.get("text")
    if isinstance(text, str) and text.strip():
        event["text_preview"] = text.strip()[:120]
    history.append(event)

    lock_info.update(
        active=True,
        reason="Vaultfire Second Law safeguard engaged",
        structure=structure,
        user_id=user_id,
        triggered_at=timestamp,
        history=history[-20:],
    )
    override["second_law_lock"] = lock_info
    _write_json(OVERRIDE_PATH, override)


def enforce_preservation(
    structure: str,
    history: List[Dict[str, Any]],
    *,
    entry: Dict[str, Any],
    user_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Apply Second Law guardrails to ``history`` and return preserved data."""

    config = _load_json(PRESERVATION_PATH, DEFAULT_CONFIG)
    threshold = float(config.get("ethics_score_threshold", DEFAULT_CONFIG["ethics_score_threshold"]))
    belief_origins = {
        str(value).lower()
        for value in config.get("belief_origins", DEFAULT_CONFIG["belief_origins"])
        if isinstance(value, str)
    }
    manual_users = {
        str(value).lower()
        for value in config.get("preserve_users", DEFAULT_CONFIG["preserve_users"])
        if isinstance(value, str)
    }
    manual_structures = {
        str(value).lower()
        for value in config.get("structure_preserve", DEFAULT_CONFIG["structure_preserve"])
        if isinstance(value, str)
    }
    human_flags = {
        str(value).lower()
        for value in config.get("human_flags", DEFAULT_CONFIG["human_flags"])
        if isinstance(value, str)
    }
    limit = int(config.get("history_limit", DEFAULT_CONFIG["history_limit"]))
    if limit < 1:
        limit = DEFAULT_CONFIG["history_limit"]

    structure_key = structure.lower()
    total = len(history)
    start_idx = 0 if structure_key in manual_structures else max(0, total - limit)

    candidate_records: List[Tuple[int, str, Dict[str, Any]]] = []
    seen_keys: Set[str] = set()
    for idx in range(start_idx, total):
        record = history[idx]
        key = _record_key(record)
        candidate_records.append((idx, key, record))
        seen_keys.add(key)

    preserved_records: List[Tuple[int, str, Dict[str, Any]]] = []
    for idx, record in enumerate(history):
        if _should_preserve_record(
            record,
            threshold,
            belief_origins,
            human_flags,
            structure_key,
            manual_structures,
            user_id,
            manual_users,
        ):
            key = _record_key(record)
            preserved_records.append((idx, key, record))

    for idx, key, record in preserved_records:
        if key not in seen_keys:
            candidate_records.append((idx, key, record))
            seen_keys.add(key)

    candidate_records.sort(key=lambda item: item[0])
    result: List[Dict[str, Any]] = []
    added: Set[str] = set()
    for _, key, record in candidate_records:
        if key in added:
            continue
        result.append(record)
        added.add(key)

    if structure_key in manual_structures:
        ordered: List[Dict[str, Any]] = []
        added.clear()
        for record in history:
            key = _record_key(record)
            if key in added:
                continue
            ordered.append(record)
            added.add(key)
        result = ordered

    if _should_trigger_lock(entry, threshold, belief_origins, manual_users, user_id):
        _activate_override_lock(structure, user_id, entry, _tags_from_record(entry), _score_from_record(entry))

    return result


__all__ = ["enforce_preservation"]
