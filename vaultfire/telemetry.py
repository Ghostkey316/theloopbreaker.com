"""Telemetry helpers for reflecting Ghostkey agent state.

This module powers the "Telemetry Mind Mirror" loop used by operational
scripts.  The helpers provide resilient wrappers around the JSON telemetry
artifacts that ship with the repository so higher level workflows can focus
on orchestration instead of file parsing.  All telemetry data is treated as
opt-in and may be missing; the helpers therefore default to defensive
behaviour and never raise on absent files or malformed entries.
"""

from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, MutableMapping, Optional, Sequence

import json

__all__ = [
    "stream_belief_logs",
    "sync_behavior_data",
    "extract_loyalty_triggers",
    "mirror_adaptive_learning",
    "push_mirror_to_dashboard",
]

_REPO_ROOT = Path(__file__).resolve().parent.parent
_TELEMETRY_DIR = _REPO_ROOT / "telemetry"
_BELIEF_LOG_PATH = _TELEMETRY_DIR / "belief-log.json"
_BASELINE_PATH = _TELEMETRY_DIR / "telemetry_baseline.json"
_DASHBOARD_PATH = _TELEMETRY_DIR / "mind_mirror_dashboard.json"


def _load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except json.JSONDecodeError:
        return default


def _write_json(path: Path, payload: Mapping[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, sort_keys=True)


def _normalise_agent(agent_id: str) -> str:
    if not agent_id or not agent_id.strip():
        raise ValueError("agent_id must be provided")
    return agent_id.strip().lower()


def stream_belief_logs(agent_id: str) -> List[MutableMapping[str, Any]]:
    """Return belief log entries for ``agent_id``.

    The belief log is optional and may contain mixed records.  The function
    therefore copies matching entries into a new list, ensuring downstream
    callers can mutate the result without affecting the persisted log.
    """

    agent_key = _normalise_agent(agent_id)
    records: Iterable[Any] = _load_json(_BELIEF_LOG_PATH, [])
    entries: List[MutableMapping[str, Any]] = []
    for record in records:
        if not isinstance(record, Mapping):
            continue
        entry_agent = str(record.get("agent_id", "")).strip().lower()
        if entry_agent and entry_agent != agent_key:
            continue
        entry: MutableMapping[str, Any] = dict(record)
        entry.setdefault("agent_id", agent_id)
        if "tags" in entry and isinstance(entry["tags"], list):
            entry["tags"] = [tag for tag in entry["tags"] if isinstance(tag, str) and tag.strip()]
        entries.append(entry)
    return entries


def sync_behavior_data(
    agent_id: str,
    *,
    belief_logs: Optional[Sequence[Mapping[str, Any]]] = None,
) -> Dict[str, Any]:
    """Assemble a lightweight behaviour snapshot for ``agent_id``.

    The behaviour sync combines baseline telemetry aggregates with the most
    recent belief log entries.  Returned payloads are meant for presentation
    and further enrichment rather than strict analytics.
    """

    normalised_agent = _normalise_agent(agent_id)
    baseline = _load_json(_BASELINE_PATH, {})
    baseline_summary = {}
    if isinstance(baseline, Mapping):
        summary = baseline.get("summary", {})
        if isinstance(summary, Mapping):
            events = summary.get("events", {})
            if isinstance(events, Mapping):
                for key, value in events.items():
                    if isinstance(key, str) and key.lower() == normalised_agent:
                        if isinstance(value, Mapping):
                            baseline_summary = dict(value)
                        break

    belief_logs = list(belief_logs) if belief_logs is not None else stream_belief_logs(agent_id)
    topic_counter: Counter[str] = Counter()
    last_belief_timestamp: str | None = None
    for entry in belief_logs:
        tags = entry.get("tags")
        if isinstance(tags, Sequence) and not isinstance(tags, (str, bytes)):
            for tag in tags:
                if isinstance(tag, str) and tag.strip():
                    topic_counter[tag.strip().lower()] += 1
        timestamp = entry.get("timestamp")
        if isinstance(timestamp, str):
            if not last_belief_timestamp or timestamp > last_belief_timestamp:
                last_belief_timestamp = timestamp

    snapshot: Dict[str, Any] = {
        "agent_id": agent_id,
        "synced_at": datetime.now(timezone.utc).isoformat(),
        "baseline_events": baseline_summary,
        "belief_total": len(belief_logs),
        "topic_focus": dict(topic_counter),
        "source_log": str(_BELIEF_LOG_PATH),
    }
    if last_belief_timestamp:
        snapshot["last_belief_timestamp"] = last_belief_timestamp
    return snapshot


def extract_loyalty_triggers(behavior_data: Mapping[str, Any]) -> Dict[str, Any]:
    """Derive loyalty oriented insights from ``behavior_data``.

    Loyalty triggers are heuristics designed for dashboard visualisation.  The
    scoring intentionally favours transparency – the function returns the raw
    counts alongside a normalised strength metric to help human operators make
    sense of the output.
    """

    topic_focus = behavior_data.get("topic_focus", {})
    topics: List[tuple[str, int]] = []
    if isinstance(topic_focus, Mapping):
        for tag, count in topic_focus.items():
            if isinstance(tag, str) and isinstance(count, int):
                topics.append((tag, count))
    topics.sort(key=lambda item: (-item[1], item[0]))

    top_topics = topics[:5]
    total = sum(count for _, count in top_topics) or 1
    belief_total = behavior_data.get("belief_total", 0)
    belief_total_int = belief_total if isinstance(belief_total, int) else 0
    triggers = [
        {
            "tag": tag,
            "count": count,
            "intensity": round(count / total, 3),
        }
        for tag, count in top_topics
    ]

    return {
        "agent_id": behavior_data.get("agent_id"),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "triggers": triggers,
        "signal_strength": round(min(1.0, total / max(1, belief_total_int or 1)), 3),
    }


def mirror_adaptive_learning(
    agent_id: str,
    behavior_data: Mapping[str, Any],
    belief_logs: Iterable[Mapping[str, Any]],
) -> Dict[str, Any]:
    """Generate an adaptive learning payload for dashboard mirroring."""

    _normalise_agent(agent_id)
    recent_beliefs: List[Dict[str, Any]] = []
    for entry in belief_logs:
        if isinstance(entry, Mapping):
            recent_beliefs.append(dict(entry))
    recent_beliefs.sort(key=lambda item: item.get("timestamp", ""), reverse=True)
    recent_beliefs = recent_beliefs[:5]

    return {
        "agent_id": agent_id,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "behavior": dict(behavior_data),
        "recent_beliefs": recent_beliefs,
        "belief_total": behavior_data.get("belief_total", len(recent_beliefs)),
    }


def push_mirror_to_dashboard(
    agent_id: str,
    updated_model: Mapping[str, Any],
    loyalty_insights: Mapping[str, Any],
) -> Dict[str, Any]:
    """Persist the mind mirror snapshot to the telemetry dashboard file."""

    _normalise_agent(agent_id)
    payload = {
        "agent_id": agent_id,
        "synced_at": datetime.now(timezone.utc).isoformat(),
        "model": dict(updated_model),
        "loyalty": dict(loyalty_insights),
    }

    dashboard = _load_json(_DASHBOARD_PATH, {"agents": []})
    agents = []
    if isinstance(dashboard, Mapping):
        agents = list(dashboard.get("agents", [])) if isinstance(dashboard.get("agents"), list) else []

    filtered_agents: List[MutableMapping[str, Any]] = []
    for entry in agents:
        if not isinstance(entry, Mapping):
            continue
        if str(entry.get("agent_id", "")).strip().lower() == agent_id.strip().lower():
            continue
        filtered_agents.append(dict(entry))
    filtered_agents.append(payload)
    filtered_agents.sort(key=lambda item: str(item.get("agent_id", "")).lower())

    _write_json(
        _DASHBOARD_PATH,
        {
            "agents": filtered_agents,
            "last_updated": payload["synced_at"],
        },
    )
    return payload

