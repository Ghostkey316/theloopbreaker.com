import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Optional

from .identity_resolver import resolve_identity
from .loyalty_multiplier import loyalty_multiplier
from .score_oracle import fetch_scores, apr_multiplier
from .ethical_growth_engine import ethics_passed
from .yield_engine_v1 import mark_yield_boost
from .token_ops import send_token

BASE_DIR = Path(__file__).resolve().parents[1]
LOG_PATH = BASE_DIR / "logs" / "life_actions.json"
BEHAVIOR_PATH = BASE_DIR / "logs" / "behavior_scores.json"

# Base point value for each allowed action type
ACTION_VALUES = {
    "learn": 1.0,
    "help": 1.5,
    "create": 2.0,
    "healthy_routine": 1.0,
    "build_tool": 2.5,
    "puzzle": 1.5,
    "ethical_mission": 3.0,
}

SUPPORTED_TOKENS = {"ASM", "USDC", "ETH"}


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


def record_life_action(user_id: str, wallet: str, action: str, details: Optional[dict] = None) -> dict:
    """Record a verifiable life action and return the log entry."""
    if action not in ACTION_VALUES:
        raise ValueError(f"Unsupported action {action}")
    resolved = resolve_identity(wallet) or wallet
    entry = {
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "user_id": user_id,
        "wallet": resolved,
        "action": action,
        "points": ACTION_VALUES[action],
    }
    if details:
        entry["details"] = details
    log = _load_json(LOG_PATH, [])
    log.append(entry)
    _write_json(LOG_PATH, log)
    return entry


def _history(user_id: str) -> list:
    log = _load_json(LOG_PATH, [])
    now = datetime.utcnow()
    cutoff = now - timedelta(days=30)
    return [e for e in log if e.get("user_id") == user_id and datetime.fromisoformat(e["timestamp"]) >= cutoff]


def behavior_score(user_id: str) -> float:
    """Return behavior score for last 30 days."""
    history = _history(user_id)
    if not history:
        return 0.0
    total = sum(e.get("points", 0) for e in history)
    days = {e["timestamp"][:10] for e in history}
    consistency = len(days) / 30.0
    ethics_mult = 1.2 if ethics_passed(user_id) else 0.8
    score = total * (1 + consistency) * ethics_mult
    data = _load_json(BEHAVIOR_PATH, {})
    data[user_id] = {"score": round(score, 2), "last_update": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")}
    _write_json(BEHAVIOR_PATH, data)
    return round(score, 2)


def calculate_life_yield(user_id: str, wallet: str) -> float:
    """Calculate token yield for ``user_id`` based on recent actions."""
    base = behavior_score(user_id)
    mult = loyalty_multiplier(user_id)
    scores = fetch_scores(user_id)
    apr = apr_multiplier(scores)
    amount = base * mult * apr
    if amount > 0:
        mark_yield_boost(user_id)
    return round(amount, 3)


def distribute_life_yield(contributor_map: Dict[str, str], token: str = "ASM") -> Dict[str, dict]:
    """Send life yield to contributors and return ledger."""
    if token not in SUPPORTED_TOKENS:
        raise ValueError(f"Token {token} not supported")
    ledger: Dict[str, dict] = {}
    for user_id, wallet in contributor_map.items():
        resolved = resolve_identity(wallet) or wallet
        amount = calculate_life_yield(user_id, resolved)
        if amount <= 0:
            continue
        send_token(resolved, amount, token)
        ledger[resolved] = {
            "amount": amount,
            "token": token,
            "user_id": user_id,
        }
    return ledger


__all__ = [
    "record_life_action",
    "behavior_score",
    "calculate_life_yield",
    "distribute_life_yield",
]
