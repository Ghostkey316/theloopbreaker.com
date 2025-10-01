"""Structured memory graph builder for Humanity Mirror reflections."""

from __future__ import annotations

import json
import re
from collections import Counter
from typing import Dict, Iterable, List, Optional

from mirror_log import memory_graph_path

EMOTION_KEYWORDS: Dict[str, Iterable[str]] = {
    "joy": ("joy", "grateful", "glad", "optimistic", "celebrate"),
    "hope": ("hope", "hopeful", "aspire", "vision", "dream"),
    "care": ("care", "caring", "support", "protect", "nurture"),
    "courage": ("courage", "brave", "fearless", "bold", "stand"),
    "fear": ("afraid", "anxious", "fear", "nervous", "worried"),
    "repair": ("repair", "restore", "apolog", "forgive", "mend"),
    "ethics": ("ethical", "integrity", "moral", "trust", "honest"),
}

THEME_KEYWORDS: Dict[str, Iterable[str]] = {
    "community": ("community", "team", "partner", "ally", "network"),
    "growth": ("growth", "learning", "improve", "progress", "evolve"),
    "resilience": ("resilience", "recover", "adapt", "bounce", "steady"),
    "loyalty": ("loyal", "commit", "dedicate", "steady", "faithful"),
    "integrity": ("integrity", "ethic", "honest", "transparent", "fair"),
    "wellness": ("well", "health", "balance", "rest", "care"),
}


def _tokenize(entry: str) -> List[str]:
    return re.findall(r"[a-zA-Z']+", entry.lower())


def _infer_matches(
    tokens: List[str],
    lookup: Dict[str, Iterable[str]],
) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    token_counter = Counter(tokens)
    for label, keywords in lookup.items():
        match_count = sum(token_counter[keyword] for keyword in keywords if keyword in token_counter)
        if match_count:
            counts[label] = match_count
    return counts


def _dominant_label(counts: Dict[str, int], default: str) -> str:
    if not counts:
        return default
    return max(counts, key=counts.get)


def _load_graph(graph_file) -> Dict[str, List[dict]]:
    if not graph_file.exists():
        return {"nodes": [], "edges": []}
    try:
        return json.loads(graph_file.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        # Reset corrupted graph while keeping a backup for inspection.
        backup = graph_file.with_suffix(".corrupted")
        graph_file.replace(backup)
        return {"nodes": [], "edges": []}


def _save_graph(graph_file, graph: Dict[str, List[dict]]) -> None:
    graph_file.write_text(json.dumps(graph, indent=2, sort_keys=True), encoding="utf-8")


def update_graph(
    entry: str,
    *,
    timestamp: str,
    alignment_score: Optional[float] = None,
) -> Dict[str, object]:
    """Update the memory graph with a new reflection entry."""

    graph_file = memory_graph_path()
    graph = _load_graph(graph_file)

    tokens = _tokenize(entry)
    emotion_counts = _infer_matches(tokens, EMOTION_KEYWORDS)
    theme_counts = _infer_matches(tokens, THEME_KEYWORDS)

    dominant_emotion = _dominant_label(emotion_counts, "reflective")
    themes = sorted(theme_counts)

    node_id = f"{timestamp}:{len(graph['nodes']) + 1}"
    node = {
        "id": node_id,
        "timestamp": timestamp,
        "dominant_emotion": dominant_emotion,
        "emotions": sorted(emotion_counts),
        "themes": themes,
        "alignment_score": alignment_score,
        "entry_length": len(tokens),
    }

    graph.setdefault("nodes", []).append(node)

    previous_nodes = graph["nodes"][:-1]
    if previous_nodes:
        previous = previous_nodes[-1]
        if set(previous.get("themes", [])) & set(themes):
            relationship = "theme_continuity"
        elif previous.get("dominant_emotion") == dominant_emotion:
            relationship = "emotional_continuity"
        else:
            relationship = "chronological"
        graph.setdefault("edges", []).append(
            {
                "source": previous["id"],
                "target": node_id,
                "relationship": relationship,
            }
        )

    _save_graph(graph_file, graph)

    theme_display = ", ".join(themes) if themes else "no tagged themes"
    print(
        f"\U0001F9E0 Memory graph updated: dominant emotion '{dominant_emotion}'"
        f" with {theme_display}."
    )

    return node


__all__ = ["update_graph"]
