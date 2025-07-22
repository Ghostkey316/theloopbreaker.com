import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
ORACLE_PATH = BASE_DIR / "dashboards" / "onchain_scores.json"

DEFAULT_SCORE = {
    "belief_alignment": 0.0,
    "consistency": 0.0,
    "community_impact": 0.0,
}


def _load_json(path: Path) -> dict:
    if path.exists():
        try:
            with open(path) as f:
                return json.load(f)
        except json.JSONDecodeError:
            return {}
    return {}


def fetch_scores(user_id: str) -> dict:
    """Return onchain scores for ``user_id`` or default."""
    data = _load_json(ORACLE_PATH)
    return data.get(user_id, DEFAULT_SCORE)


def apr_multiplier(scores: dict) -> float:
    """Return APR multiplier from score values."""
    alignment = scores.get("belief_alignment", 0.0)
    consistency = scores.get("consistency", 0.0)
    impact = scores.get("community_impact", 0.0)
    mult = 1 + alignment * 0.01 + consistency * 0.005 + impact * 0.01
    return max(mult, 0.0)


__all__ = ["fetch_scores", "apr_multiplier"]
