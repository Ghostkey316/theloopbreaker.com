"""Signal scoring for Humanity Mirror reflections."""

from __future__ import annotations

import re
from typing import Dict, List

ALIGNMENT_WEIGHTS: Dict[str, int] = {
    # Positive orientation
    "honest": 3,
    "grateful": 2,
    "hopeful": 2,
    "generous": 2,
    "caring": 2,
    "transparent": 3,
    "kind": 2,
    "empathetic": 2,
    "responsible": 2,
    "courage": 3,
    "repair": 2,
    "ethical": 3,
    "forgive": 2,
    "support": 2,
    # Growth or negative orientation
    "afraid": -1,
    "angry": -1,
    "selfish": -3,
    "regret": -2,
    "ashamed": -2,
    "avoid": -1,
    "resent": -2,
    "harm": -3,
    "dishonest": -3,
}

_POSITIVE_BOUND = sum(weight for weight in ALIGNMENT_WEIGHTS.values() if weight > 0)
_NEGATIVE_BOUND = sum(-weight for weight in ALIGNMENT_WEIGHTS.values() if weight < 0)
_SCORE_RANGE = max(1, _POSITIVE_BOUND + _NEGATIVE_BOUND)


def _tokenize(entry: str) -> List[str]:
    return re.findall(r"[a-zA-Z']+", entry.lower())


def _normalize_score(raw_score: int) -> float:
    shifted = raw_score + _NEGATIVE_BOUND
    normalized = (shifted / _SCORE_RANGE) * 100
    return max(0.0, min(100.0, round(normalized, 2)))


def _orientation(normalized_score: float) -> str:
    if normalized_score >= 75:
        return "strong integrity signal"
    if normalized_score >= 55:
        return "aligned with growth"
    if normalized_score >= 35:
        return "needs gentle course correction"
    return "requires immediate reflection"


def evaluate_entry(entry: str) -> Dict[str, object]:
    """Evaluate a reflection entry and emit an interpretable alignment score."""

    tokens = _tokenize(entry)
    matched_keywords = [word for word in ALIGNMENT_WEIGHTS if word in tokens]
    raw_score = sum(ALIGNMENT_WEIGHTS[word] for word in matched_keywords)
    normalized = _normalize_score(raw_score)
    orientation = _orientation(normalized)

    keyword_display = ", ".join(matched_keywords) if matched_keywords else "no direct keywords"
    print(
        f"\U0001F9ED Moral alignment score: {normalized:.0f}/100 — {orientation}."
        f" Keywords: {keyword_display}."
    )

    return {
        "raw_score": raw_score,
        "normalized": normalized,
        "orientation": orientation,
        "keywords": matched_keywords,
    }


__all__ = ["evaluate_entry"]
