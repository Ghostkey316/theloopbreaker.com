from __future__ import annotations

"""Reward handlers for verified signal events."""

import json
from datetime import datetime
from pathlib import Path
import urllib.request

from .token_ops import send_token

BASE_DIR = Path(__file__).resolve().parents[1]
REWARD_LOG_PATH = BASE_DIR / "logs" / "signal_reward_log.json"
SCORECARD_PATH = BASE_DIR / "user_scorecard.json"

VALID_EVENTS = {"loop_complete", "teaching_moment", "sacrifice_for_belief"}


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


def _notify_backend(entry: dict) -> None:
    """Optionally POST reward to backend."""
    try:
        req = urllib.request.Request(
            "http://localhost/vaultfire/api/reward",
            data=json.dumps(entry).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        urllib.request.urlopen(req, timeout=2)
    except Exception:
        pass


def reward_signal_event(user_id: str, wallet: str, event_type: str) -> dict:
    """Grant rewards when ``event_type`` is verified."""
    if event_type not in VALID_EVENTS:
        return {}

    send_token(wallet, 1, "BELIEF")

    scorecard = _load_json(SCORECARD_PATH, {})
    user = scorecard.get(user_id, {})
    badges = set(user.get("badges", []))
    badges.add("contributor")
    user["badges"] = sorted(badges)
    user["wallet"] = wallet
    scorecard[user_id] = user
    _write_json(SCORECARD_PATH, scorecard)

    entry = {
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "user_id": user_id,
        "wallet": wallet,
        "event": event_type,
    }
    log = _load_json(REWARD_LOG_PATH, [])
    log.append(entry)
    _write_json(REWARD_LOG_PATH, log)

    _notify_backend(entry)

    return entry
