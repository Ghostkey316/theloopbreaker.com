from __future__ import annotations

"""Generate and compare per-user belief graphs."""

import json
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Iterable, Tuple

from .soul_journal import get_entries

BASE_DIR = Path(__file__).resolve().parents[1]
VALUES_PATH = BASE_DIR / "vaultfire-core" / "ghostkey_values.json"
ACTIONS_PATH = BASE_DIR / "logs" / "game_actions.json"
QUEST_PATH = BASE_DIR / "logs" / "partner_port_quests.json"
GRAPH_DIR = BASE_DIR / "logs" / "belief_graph"


def _load_json(path: Path, default):
    if path.exists():
        try:
            with open(path) as f:
                return json.load(f)
        except json.JSONDecodeError:
            return default
    return default


def _write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def _value_phrases() -> List[str]:
    data = _load_json(VALUES_PATH, {})
    return [k.replace("_", " ") for k in data.keys() if not k.endswith("multipliers")]


def _count_matches(text: str, phrases: Iterable[str]) -> Counter:
    counts: Counter[str] = Counter()
    lower = text.lower()
    for p in phrases:
        if p.lower() in lower:
            counts[p] += 1
    return counts


def build_belief_graph(user_id: str) -> Dict[str, Dict[str, int]]:
    """Create or update ``user_id`` belief graph and return it."""
    phrases = _value_phrases()
    graph: Dict[str, Dict[str, int]] = {p: {"posts": 0, "decisions": 0, "quests": 0} for p in phrases}

    # journal posts
    posts = get_entries(user_id)
    for entry in posts:
        text = entry.get("text", "")
        for val, cnt in _count_matches(text, phrases).items():
            graph[val]["posts"] += cnt

    # decisions from game actions
    actions = _load_json(ACTIONS_PATH, [])
    for act in actions:
        if act.get("user_id") != user_id:
            continue
        decision = str(act.get("decision", ""))
        for val, cnt in _count_matches(decision, phrases).items():
            graph[val]["decisions"] += cnt

    # completed quests
    quests = _load_json(QUEST_PATH, {})
    user_quests = quests.get(user_id, {})
    for qid, progress in user_quests.items():
        if progress < 1:
            continue
        for val, cnt in _count_matches(qid, phrases).items():
            graph[val]["quests"] += cnt

    path = GRAPH_DIR / f"{user_id}.json"
    _write_json(path, {"timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"), "graph": graph})
    return graph


def _value_set(graph: Dict[str, Dict[str, int]]) -> set[str]:
    return {v for v, info in graph.items() if any(info.values())}


def graph_similarity(a: Dict[str, Dict[str, int]], b: Dict[str, Dict[str, int]]) -> float:
    """Return Jaccard similarity of two belief graphs."""
    set_a = _value_set(a)
    set_b = _value_set(b)
    if not set_a and not set_b:
        return 0.0
    intersection = len(set_a & set_b)
    union = len(set_a | set_b)
    if union == 0:
        return 0.0
    return round(intersection / union, 3)


def match_users(user_id: str, others: Iterable[str], top_n: int = 3) -> List[Tuple[str, float]]:
    """Return ``top_n`` users most similar to ``user_id`` by belief graph."""
    base = build_belief_graph(user_id)
    scores: List[Tuple[str, float]] = []
    for uid in others:
        if uid == user_id:
            continue
        g = build_belief_graph(uid)
        sim = graph_similarity(base, g)
        if sim > 0:
            scores.append((uid, sim))
    scores.sort(key=lambda x: x[1], reverse=True)
    return scores[:top_n]


def trust_metric(graph: Dict[str, Dict[str, int]]) -> float:
    """Compute simple trust metric from graph activity."""
    total_mentions = sum(sum(info.values()) for info in graph.values())
    active_values = len([1 for info in graph.values() if any(info.values())])
    if active_values == 0:
        return 0.0
    return round(total_mentions / active_values, 3)


__all__ = [
    "build_belief_graph",
    "graph_similarity",
    "match_users",
    "trust_metric",
]
