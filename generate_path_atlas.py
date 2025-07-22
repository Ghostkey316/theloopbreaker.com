import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
STATE_PATH = BASE_DIR / "logs" / "life_path_state.json"
SCORECARD_PATH = BASE_DIR / "user_scorecard.json"
ATLAS_PATH = BASE_DIR / "dashboards" / "path_atlas.json"


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


def build_atlas() -> dict:
    life_state = _load_json(STATE_PATH, {})
    scorecard = _load_json(SCORECARD_PATH, {})

    participants = []
    summary = {}
    for user, info in life_state.items():
        path_arc = info.get("path", "unknown")
        summary[path_arc] = summary.get(path_arc, 0) + 1
        participants.append({
            "user": user,
            "path": path_arc,
            "score": scorecard.get(user, {}).get("contributor_score", 0),
            "timestamp": info.get("timestamp"),
        })

    atlas = {"participants": participants, "summary": summary}
    _write_json(ATLAS_PATH, atlas)
    return atlas


if __name__ == "__main__":
    data = build_atlas()
    print(json.dumps(data, indent=2))
