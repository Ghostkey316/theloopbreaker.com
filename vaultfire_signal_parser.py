"""Parse Vaultfire belief signals with abuse-resistant scoring."""
from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path
from typing import Dict

POSITIVE_WORDS = {
    "open",
    "ethical",
    "collaborate",
    "truth",
    "support",
    "generous",
    "help",
    "positive",
    "build",
    "care",
}
NEGATIVE_WORDS = {
    "scam",
    "hate",
    "exploit",
    "harm",
    "deceive",
    "fraud",
    "steal",
    "negative",
    "selfish",
    "pump",
}
LOYALTY_WORDS = {
    "loyal",
    "consistent",
    "sacrifice",
    "truth-seeking",
    "truth",
    "commit",
    "aligned",
    "collaborate",
    "community",
}
LOOP_ACTIVATORS = {"believe", "act", "teach", "grow"}

_WORD_RE = re.compile(r"[a-z0-9']+")


def _tokenize(text: str) -> Counter[str]:
    tokens = _WORD_RE.findall(text.lower())
    return Counter(tokens)


def _keyword_presence(counter: Counter[str], keywords: set[str]) -> int:
    return sum(1 for word in keywords if counter.get(word))


def _keyword_strength(
    counter: Counter[str],
    keywords: set[str],
    *,
    per_hit_bonus: float = 0.0,
    cap: int = 3,
) -> float:
    score = 0.0
    for word in keywords:
        freq = counter.get(word, 0)
        if freq:
            score += 1.0
            if per_hit_bonus and freq > 1:
                score += min(freq - 1, cap) * per_hit_bonus
    return score


def _repetition_ratio(counter: Counter[str]) -> float:
    total = sum(counter.values())
    if total == 0:
        return 0.0
    return max(counter.values()) / total


def parse_signal(text: str) -> Dict[str, object]:
    counter = _tokenize(text)
    total_tokens = sum(counter.values())
    diversity = len(counter)

    positive_strength = _keyword_strength(counter, POSITIVE_WORDS, per_hit_bonus=0.25)
    negative_strength = _keyword_strength(counter, NEGATIVE_WORDS, per_hit_bonus=0.5)
    loyalty_strength = _keyword_strength(counter, LOYALTY_WORDS, per_hit_bonus=0.5)
    loyalty_hits = _keyword_presence(counter, LOYALTY_WORDS)
    loop_strength = _keyword_strength(counter, LOOP_ACTIVATORS, per_hit_bonus=0.25, cap=2)
    loop_hits = _keyword_presence(counter, LOOP_ACTIVATORS)

    repetition = _repetition_ratio(counter)
    penalty = 0.0
    if total_tokens < 5:
        penalty += 10.0
    if diversity < 4:
        penalty += 5.0
    if repetition > 0.35:
        penalty += (repetition - 0.35) * 50

    length_bonus = min(total_tokens // 6, 5)
    sentiment = positive_strength - negative_strength

    base_score = 20
    score = (
        base_score
        + sentiment * 4
        + loyalty_strength * 6
        + loop_strength * 3
        + length_bonus
        - penalty
    )
    score = max(1, min(100, round(score)))

    verified = (
        score >= 40
        and loyalty_hits > 0
        and diversity >= 4
        and repetition <= 0.6
    )

    return {
        "verified": verified,
        "score": score,
        "belief_intensity": round(sentiment, 2),
        "loyalty_markers": loyalty_hits,
        "loop_activators": loop_hits,
        "unique_tokens": diversity,
        "repetition_ratio": round(repetition, 3),
    }


def _cli() -> None:
    parser = argparse.ArgumentParser(description="Parse Vaultfire signal")
    parser.add_argument("--text", help="Text to analyze")
    parser.add_argument("--file", type=Path, help="Optional file with text")
    args = parser.parse_args()

    if args.file:
        text = args.file.read_text()
    else:
        text = args.text or ""

    result = parse_signal(text)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    _cli()
