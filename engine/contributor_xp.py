import json
from pathlib import Path
from typing import Dict

from .identity_resolver import resolve_identity

BASE_DIR = Path(__file__).resolve().parents[1]
SCORECARD_PATH = BASE_DIR / "user_scorecard.json"
ENGAGEMENT_PATH = BASE_DIR / "logs" / "engagement_data.json"
EVENT_LOG_PATH = BASE_DIR / "event_log.json"


def _load_json(path: Path, default):
    if path.exists():
        try:
            with open(path) as f:
                return json.load(f)
        except json.JSONDecodeError:
            return default
    return default


def _engagement_score(wallet: str) -> float:
    data = _load_json(ENGAGEMENT_PATH, {})
    metrics = data.get(wallet)
    if not metrics:
        return 0.0
    weights = {
        "likes": 0.5,
        "shares": 1.0,
        "scroll_depth": 0.3,
        "read_time": 0.2,
    }
    return sum(metrics.get(m, 0) * w for m, w in weights.items())


def _prompt_activity(user_id: str) -> int:
    events = _load_json(EVENT_LOG_PATH, [])
    return sum(1 for e in events if e.get("user_id") == user_id)


def xp_score(user_id: str) -> Dict:
    """Return XP info for ``user_id`` based on scorecard and engagement."""
    scorecard = _load_json(SCORECARD_PATH, {})
    info = scorecard.get(user_id, {})
    wallet = info.get("wallet", "")
    resolved = resolve_identity(wallet) or wallet
    ethics = info.get("alignment_score", 0)
    engagement = _engagement_score(resolved)
    prompts = _prompt_activity(user_id)
    xp_val = round(ethics * 0.5 + engagement * 0.3 + prompts * 0.2)
    return {
        "wallet": wallet,
        "resolved_wallet": resolved,
        "xp": xp_val,
    }
