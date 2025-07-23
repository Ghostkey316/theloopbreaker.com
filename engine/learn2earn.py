"""Learn2Earn protocol utilities."""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Dict

from .ethical_growth_engine import learning_multiplier, record_mirror_entry
from .life_xp_module import reward_lesson
from .life_yield_engine import record_life_action, calculate_life_yield
from .token_ops import send_token
from .social_layer import post_signal
from .gamified_yield_layer import complete_task
from .fit_sync import record_workout_sync
from .play2earn import record_session

BASE_DIR = Path(__file__).resolve().parents[1]
LOG_PATH = BASE_DIR / "logs" / "learn2earn.json"
SUPPORTED_TOKENS = {"ASM", "WLD", "ETH"}


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


def _log(user_id: str, key: str, entry: Dict) -> None:
    data = _load_json(LOG_PATH, {})
    info = data.setdefault(user_id, {"quizzes": [], "lessons": []})
    info[key].append(entry)
    _write_json(LOG_PATH, data)


def log_quiz(user_id: str, quiz_id: str, score: float) -> Dict:
    """Record quiz result scaled by reputation."""
    mult = learning_multiplier(user_id)
    xp = round(score * mult, 2)
    entry = {
        "quiz": quiz_id,
        "score": score,
        "xp": xp,
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    _log(user_id, "quizzes", entry)
    record_mirror_entry(user_id, f"quiz:{quiz_id}:{score}")
    post_signal(user_id, user_id, "learn", "positive", quiz_id)
    complete_task(user_id, "growth", "learn")
    record_session(user_id, quiz_id, "web", 0)
    record_workout_sync(user_id, "learn2earn", {"minutes": 0, "avg_hr": 0})
    return entry


def complete_lesson(
    user_id: str,
    lesson_id: str,
    wallet: str,
    passed: bool = True,
    token: str = "ASM",
) -> Dict:
    """Reward lesson completion and distribute yield."""
    reward_lesson(user_id, lesson_id, "learn2earn", passed)
    record_life_action(user_id, wallet, "learn", {"lesson": lesson_id})
    amount = calculate_life_yield(user_id, wallet)
    if token in SUPPORTED_TOKENS and amount > 0:
        try:
            send_token(wallet, amount, token)
        except Exception:
            pass
    post_signal(user_id, user_id, "learned", "positive", lesson_id)
    complete_task(user_id, "growth", "learn")
    record_session(user_id, lesson_id, "web", 0)
    record_workout_sync(user_id, "learn2earn", {"minutes": 0, "avg_hr": 0})
    entry = {
        "lesson": lesson_id,
        "passed": passed,
        "yield": amount,
        "token": token,
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    _log(user_id, "lessons", entry)
    return entry


__all__ = ["log_quiz", "complete_lesson"]
