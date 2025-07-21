# Reference: ethics/core.mdx
import json
from datetime import datetime
from pathlib import Path
from engine.mission_registry import get_mission

BASE_DIR = Path(__file__).resolve().parents[1]
FEEDBACK_PATH = BASE_DIR / "logs" / "alignment_feedback.json"
SCORECARD_PATH = BASE_DIR / "user_scorecard.json"


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


def _apply_rating(user_id: str, rating: int) -> None:
    """Adjust trust behavior metric based on ``rating``."""
    scorecard = _load_json(SCORECARD_PATH, {})
    user = scorecard.get(user_id, {})
    delta = 0
    if rating >= 4:
        delta = 1
    elif rating <= 2:
        delta = -1
    if delta:
        user["trust_behavior"] = user.get("trust_behavior", 0) + delta
        scorecard[user_id] = user
        _write_json(SCORECARD_PATH, scorecard)


def record_alignment_feedback(user_id: str, decision: str, rating: int, comment: str | None = None) -> dict:
    """Record a feedback entry and apply its effect to the scorecard."""
    entry = {
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "user_id": user_id,
        "decision": decision,
        "rating": rating,
    }
    if comment:
        entry["comment"] = comment
    mission = get_mission(user_id)
    if mission:
        entry["mission"] = mission
    log = _load_json(FEEDBACK_PATH, [])
    log.append(entry)
    _write_json(FEEDBACK_PATH, log)
    _apply_rating(user_id, rating)
    return entry


def _cli():
    import argparse

    parser = argparse.ArgumentParser(description="Record alignment feedback")
    parser.add_argument("--user", required=True, help="User ID providing feedback")
    parser.add_argument("--decision", required=True, help="ID or summary of AI decision")
    parser.add_argument("--rating", type=int, choices=range(1, 6), required=True, help="Rating 1-5")
    parser.add_argument("--comment", help="Optional comment")
    args = parser.parse_args()

    entry = record_alignment_feedback(args.user, args.decision, args.rating, args.comment)
    print(json.dumps(entry, indent=2))


if __name__ == "__main__":
    _cli()
