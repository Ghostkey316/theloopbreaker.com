from __future__ import annotations

import argparse
import json
import statistics
from pathlib import Path
from typing import Iterable, List, Mapping, Sequence


def calculate_mirror_score(prompts: Sequence[str]) -> int:
    if not prompts:
        return 0
    average_length = statistics.mean(len(prompt) for prompt in prompts)
    diversity = len({word for prompt in prompts for word in prompt.split()})
    normalized = min(1.0, (average_length / 240) + (diversity / 500))
    return min(316, max(0, int(normalized * 316)))


def growth_trends(previous_scores: Iterable[int], current_score: int) -> Mapping[str, float]:
    scores = list(previous_scores)
    if not scores:
        return {"delta": current_score, "trend": 100.0}
    delta = current_score - scores[-1]
    momentum = (sum(scores[-5:]) + current_score) / min(len(scores[-5:]) + 1, 6)
    return {"delta": delta, "trend": round(momentum, 2)}


def export_feed(score: int, trend: Mapping[str, float], prompts: Sequence[str], output_path: Path) -> Path:
    payload = {
        "score": score,
        "trend": trend,
        "prompts": list(prompts),
        "farcaster_ready": True,
        "mirror": "vaultfire_reflector",
    }
    output_path.write_text(f"export const vaultfireReflectorFeed = {json.dumps(payload, indent=2)};\n")
    return output_path


def load_prompts(path: Path) -> List[str]:
    if not path.exists():
        raise FileNotFoundError(f"Prompt archive missing at {path}")
    raw = path.read_text().splitlines()
    return [line.strip() for line in raw if line.strip()]


def main() -> None:
    parser = argparse.ArgumentParser(description="Reprocess prompts and emit mirror score")
    parser.add_argument("--prompt", action="append", help="Prompt to reflect", dest="prompts")
    parser.add_argument("--prompt-file", help="Path to historic prompts to reflect")
    parser.add_argument("--history", help="Optional JSON file with previous scores")
    parser.add_argument("--output", default="vaultfire_reflector.js", help="Where to write Farcaster-ready feed")
    args = parser.parse_args()

    prompts: List[str] = []
    if args.prompts:
        prompts.extend(args.prompts)
    if args.prompt_file:
        prompts.extend(load_prompts(Path(args.prompt_file)))

    score = calculate_mirror_score(prompts)
    previous_scores: List[int] = []
    if args.history and Path(args.history).exists():
        previous_scores = json.loads(Path(args.history).read_text())
    trend = growth_trends(previous_scores, score)

    feed_path = export_feed(score, trend, prompts, Path(args.output))
    print(json.dumps({"score": score, "trend": trend, "feed": str(feed_path)}, indent=2))


if __name__ == "__main__":
    main()
