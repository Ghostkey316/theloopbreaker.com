import argparse
from pathlib import Path
import json

POSITIVE_WORDS = {
    "open", "ethical", "collaborate", "truth", "support",
    "generous", "help", "positive", "build", "care",
}
NEGATIVE_WORDS = {
    "scam", "hate", "exploit", "harm", "deceive",
    "fraud", "steal", "negative", "selfish", "pump",
}
LOYALTY_WORDS = {
    "loyal", "consistent", "sacrifice", "truth-seeking", "truth",
    "commit", "aligned", "collaborate", "community",
}
LOOP_ACTIVATORS = {"believe", "act", "teach", "grow"}


def _count_keywords(text: str, keywords: set[str]) -> int:
    count = 0
    for word in keywords:
        count += text.count(word)
    return count


def parse_signal(text: str) -> dict:
    text_lower = text.lower()
    pos = _count_keywords(text_lower, POSITIVE_WORDS)
    neg = _count_keywords(text_lower, NEGATIVE_WORDS)
    loyalty = _count_keywords(text_lower, LOYALTY_WORDS)
    loops = _count_keywords(text_lower, LOOP_ACTIVATORS)

    belief_intensity = pos - neg
    base_score = 10 + belief_intensity * 5 + loyalty * 5 + loops * 2
    score = max(1, min(100, base_score))
    verified = score >= 20
    return {
        "verified": verified,
        "score": score,
        "belief_intensity": belief_intensity,
        "loyalty_markers": loyalty,
        "loop_activators": loops,
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
