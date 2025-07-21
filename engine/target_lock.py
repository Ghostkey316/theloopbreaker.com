# Reference: ethics/core.mdx
"""Target lock reward system for early supporters."""

import json
from datetime import datetime
from pathlib import Path

from .loyalty_engine import loyalty_score
from .token_ops import send_token

BASE_DIR = Path(__file__).resolve().parents[1]
LOCKS_PATH = BASE_DIR / "target_locks.json"

BONUS_MIN = 0.2
BONUS_MAX = 1.0


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


def set_target_lock(user_id: str, target_value: float) -> dict:
    """Create or update a target lock for ``user_id``."""
    locks = _load_json(LOCKS_PATH, {})
    locks[user_id] = {
        "target": float(target_value),
        "active": True,
        "hit": False,
        "bonus_pct": 0.0,
        "start": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    _write_json(LOCKS_PATH, locks)
    return locks[user_id]


def exit_target_lock(user_id: str) -> None:
    """Cancel target lock for ``user_id`` without bonus."""
    locks = _load_json(LOCKS_PATH, {})
    info = locks.get(user_id)
    if not info:
        return
    info.update({"active": False, "hit": False, "bonus_pct": 0.0})
    locks[user_id] = info
    _write_json(LOCKS_PATH, locks)


def _calc_bonus_pct(user_id: str) -> float:
    info = loyalty_score(user_id)
    score = info.get("score", 0)
    ratio = max(0.0, min(score / 100.0, 1.0))
    pct = BONUS_MIN + ratio * (BONUS_MAX - BONUS_MIN)
    return round(pct, 2)


def update_value(user_id: str, current_value: float) -> dict:
    """Check ``current_value`` against target and update status."""
    locks = _load_json(LOCKS_PATH, {})
    info = locks.get(user_id)
    if not info or not info.get("active"):
        return {}
    if info.get("hit"):
        return info
    if current_value >= info.get("target", 0):
        pct = _calc_bonus_pct(user_id)
        info.update({"hit": True, "bonus_pct": pct})
        locks[user_id] = info
        _write_json(LOCKS_PATH, locks)
    return info or {}


def claim_bonus(user_id: str, base_reward: float, wallet: str, token: str = "ASM") -> dict:
    """Send retro bonus if target was reached."""
    locks = _load_json(LOCKS_PATH, {})
    info = locks.get(user_id)
    if not info or not info.get("hit") or not info.get("active"):
        return {}
    bonus = base_reward * info.get("bonus_pct", 0)
    send_token(wallet, bonus, token)
    info.update({"active": False, "claimed": True})
    locks[user_id] = info
    _write_json(LOCKS_PATH, locks)
    return {"wallet": wallet, "bonus": bonus, "token": token, "pct": info["bonus_pct"]}


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Manage target locks")
    sub = parser.add_subparsers(dest="cmd")

    p_set = sub.add_parser("set")
    p_set.add_argument("--user", required=True)
    p_set.add_argument("--target", type=float, required=True)

    p_update = sub.add_parser("update")
    p_update.add_argument("--user", required=True)
    p_update.add_argument("--value", type=float, required=True)

    p_exit = sub.add_parser("exit")
    p_exit.add_argument("--user", required=True)

    args = parser.parse_args()
    if args.cmd == "set":
        print(json.dumps(set_target_lock(args.user, args.target), indent=2))
    elif args.cmd == "update":
        print(json.dumps(update_value(args.user, args.value), indent=2))
    elif args.cmd == "exit":
        exit_target_lock(args.user)
        print("Exited")
