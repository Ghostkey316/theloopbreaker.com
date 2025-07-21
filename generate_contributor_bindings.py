import json
from pathlib import Path

from engine.contributor_xp import xp_score
from engine.loyalty_multiplier import loyalty_multiplier

BASE_DIR = Path(__file__).resolve().parent
SCORECARD_PATH = BASE_DIR / "user_scorecard.json"
BINDINGS_PATH = BASE_DIR / "dashboards" / "contributor_bindings.json"


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


def generate_bindings() -> dict:
    scorecard = _load_json(SCORECARD_PATH, {})
    bindings = {}
    for uid in scorecard.keys():
        xp_info = xp_score(uid)
        mult = loyalty_multiplier(uid)
        bindings[uid] = {
            "wallet": xp_info["wallet"],
            "resolved_wallet": xp_info["resolved_wallet"],
            "contributor_xp": xp_info["xp"],
            "loyalty_multiplier": mult,
        }
    _write_json(BINDINGS_PATH, bindings)
    return bindings


if __name__ == "__main__":
    data = generate_bindings()
    print(json.dumps(data, indent=2))
