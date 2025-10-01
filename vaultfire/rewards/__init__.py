"""Reward routing heuristics for Humanity Mirror reflections."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Mapping, Optional

from mirror_log import reward_stream_path

BASE_REWARD = 10.0
ALIGNMENT_WEIGHT = 0.6
LENGTH_WEIGHT = 0.4

EMOTION_MULTIPLIERS: Mapping[str, float] = {
    "joy": 1.15,
    "hope": 1.1,
    "care": 1.08,
    "courage": 1.12,
    "repair": 1.05,
    "ethics": 1.2,
    "fear": 0.85,
}


def _load_partner_config(config_path: Path) -> Dict[str, dict]:
    if not config_path.exists():
        return {}
    try:
        return json.loads(config_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def _alignment_multiplier(normalized_score: Optional[float]) -> float:
    if normalized_score is None:
        return 1.0
    centered = (normalized_score - 50.0) / 50.0
    multiplier = 1.0 + centered * ALIGNMENT_WEIGHT
    return max(0.4, round(multiplier, 4))


def _length_multiplier(entry: str) -> float:
    words = entry.split()
    if not words:
        return 1.0
    factor = min(len(words) / 120.0, 1.0)
    multiplier = 1.0 + factor * LENGTH_WEIGHT
    return round(multiplier, 4)


def _emotion_multiplier(dominant_emotion: Optional[str]) -> float:
    if not dominant_emotion:
        return 1.0
    return EMOTION_MULTIPLIERS.get(dominant_emotion, 1.0)


def _build_distribution(partners: Mapping[str, dict], total_amount: float) -> List[dict]:
    if not partners:
        return []
    share = total_amount / len(partners)
    return [
        {
            "partner": partner,
            "wallet": details.get("wallet"),
            "amount": round(share, 2),
            "reward_flow_routing": details.get("reward_flow_routing", "UNKNOWN"),
        }
        for partner, details in sorted(partners.items())
    ]


def calculate(
    entry: str,
    *,
    alignment: Optional[Mapping[str, object]] = None,
    graph_node: Optional[Mapping[str, object]] = None,
    timestamp: Optional[str] = None,
) -> Dict[str, object]:
    """Compute a reflection reward event and persist it to the reward stream."""

    partners = _load_partner_config(Path("vaultfire_rewards.json"))
    normalized_score = None
    matched_keywords: Iterable[str] = ()
    if alignment:
        normalized_score = alignment.get("normalized")  # type: ignore[assignment]
        matched_keywords = alignment.get("keywords", ())  # type: ignore[assignment]

    dominant_emotion = None
    themes: Iterable[str] = ()
    if graph_node:
        dominant_emotion = graph_node.get("dominant_emotion")
        themes = graph_node.get("themes", ())

    alignment_mult = _alignment_multiplier(
        float(normalized_score) if normalized_score is not None else None
    )
    length_mult = _length_multiplier(entry)
    emotion_mult = _emotion_multiplier(dominant_emotion if isinstance(dominant_emotion, str) else None)

    total_multiplier = round(alignment_mult * length_mult * emotion_mult, 4)
    calculated_amount = round(BASE_REWARD * total_multiplier, 2)

    event_timestamp = timestamp or datetime.now(timezone.utc).isoformat()

    event = {
        "timestamp": event_timestamp,
        "base_amount": BASE_REWARD,
        "total_multiplier": total_multiplier,
        "calculated_amount": calculated_amount,
        "alignment_score": normalized_score,
        "alignment_keywords": list(matched_keywords),
        "dominant_emotion": dominant_emotion,
        "themes": list(themes),
        "partners": _build_distribution(partners, calculated_amount),
    }

    stream_file = reward_stream_path()
    with stream_file.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event) + "\n")

    print(
        "\U0001F48E Reward stream update:"
        f" {calculated_amount:.2f} units routed across {len(event['partners']) or 'no'} partners"
        f" (multiplier {total_multiplier})."
    )

    return event


__all__ = ["calculate"]
