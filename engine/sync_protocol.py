"""Sync functions for belief alignment with external systems."""

import json
import os
from pathlib import Path
from datetime import datetime

BASE_DIR = Path(__file__).resolve().parents[1]
SCORECARD_PATH = BASE_DIR / "user_scorecard.json"
AUDIT_PATH = BASE_DIR / "logs" / "sync_audit.json"


def _load_json(path, default):
    if path.exists():
        try:
            with open(path) as f:
                return json.load(f)
        except json.JSONDecodeError:
            return default
    return default


def _write_json(path, data):
    os.makedirs(path.parent, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def _log_audit(entry):
    log = _load_json(AUDIT_PATH, [])
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    entry_with_time = {"timestamp": timestamp, **entry}
    log.append(entry_with_time)
    _write_json(AUDIT_PATH, log)


# ---------------------------------------------------------------------------

def sync_ns3(user_id):
    """Check NS3 quiz results and apply alignment score."""
    progress_path = BASE_DIR / "dashboards" / "ns3_progress.json"
    progress = _load_json(progress_path, {})
    data = progress.get(user_id, {})
    alignment = data.get("quiz_score", 0)
    loyalty = data.get("loyalty_points", 0)

    scorecard = _load_json(SCORECARD_PATH, {})
    user_card = scorecard.get(user_id, {})
    user_card["alignment_score"] = user_card.get("alignment_score", 0) + alignment
    user_card["loyalty"] = user_card.get("loyalty", 0) + loyalty
    scorecard[user_id] = user_card
    _write_json(SCORECARD_PATH, scorecard)
    _log_audit({"action": "sync_ns3", "user_id": user_id,
                "alignment_added": alignment, "loyalty_added": loyalty})


def sync_openai(user_id):
    """Sync OpenAI reflection metrics."""
    reflection_path = BASE_DIR / "dashboards" / "openai_feedback.json"
    feedback = _load_json(reflection_path, {})
    data = feedback.get(user_id, {})
    depth = data.get("depth", 0)
    consistency = data.get("consistency", 0)
    trust = depth + consistency

    scorecard = _load_json(SCORECARD_PATH, {})
    user_card = scorecard.get(user_id, {})
    user_card["trust_behavior"] = user_card.get("trust_behavior", 0) + trust
    if data.get("follows_commandments"):
        flags = set(user_card.get("flags", []))
        flags.add("follows_commandments")
        user_card["flags"] = sorted(flags)
    scorecard[user_id] = user_card
    _write_json(SCORECARD_PATH, scorecard)
    _log_audit({"action": "sync_openai", "user_id": user_id,
                "trust_added": trust})


def sync_worldcoin(user_id):
    """Verify Worldcoin identity and award trust bonus."""
    status_path = BASE_DIR / "dashboards" / "worldcoin_status.json"
    status = _load_json(status_path, {})
    data = status.get(user_id, {})
    verified = bool(data.get("verified"))

    scorecard = _load_json(SCORECARD_PATH, {})
    user_card = scorecard.get(user_id, {})
    badges = set(user_card.get("badges", []))
    trust_bonus = 20 if verified else 0
    user_card["trust_bonus"] = user_card.get("trust_bonus", 0) + trust_bonus
    if verified:
        badges.add("global_passport")
    user_card["badges"] = sorted(badges)
    scorecard[user_id] = user_card
    _write_json(SCORECARD_PATH, scorecard)
    _log_audit({"action": "sync_worldcoin", "user_id": user_id,
                "verified": verified, "trust_bonus": trust_bonus})


def global_sync_pulse(user_list=None):
    """Run all sync functions for each user in ``user_list``.

    Parameters
    ----------
    user_list : list[str] or None
        Iterable of user identifiers. If ``None`` the list is loaded from
        ``user_scorecard.json`` keys.
    """
    if user_list is None:
        scorecard = _load_json(SCORECARD_PATH, {})
        user_list = list(scorecard.keys())

    for user in user_list:
        sync_ns3(user)
        sync_openai(user)
        sync_worldcoin(user)


