# Reference: ethics/core.mdx
import json
import os
from pathlib import Path
from datetime import datetime

from vaultfire_signal import log_vaultfire_status
from .yield_engine_v1 import mark_yield_boost
from .belief_validation import validate_belief
from .immutable_log import append_entry

BASE_DIR = Path(__file__).resolve().parents[1]
EVENT_LOG_PATH = BASE_DIR / "event_log.json"
SCORECARD_PATH = BASE_DIR / "user_scorecard.json"
AUDIT_PATH = BASE_DIR / "logs" / "feedback_audit.json"
HEARTBEAT_PATH = BASE_DIR / "dashboards" / "ghostkey_heartbeat.json"

# Map user actions to score adjustments
ACTION_VALUE_MAP = {
    "mission_complete": {"belief_level": 1, "impact_score": 3},
    "help_new_user": {"loyalty": 2},
    "ethical_action": {"belief_level": 1, "loyalty": 1, "impact_score": 1},
    "submit_belief": {},
}

THRESHOLD = 10


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


def track_behavior(event):
    """Record a single user event and update scorecard."""
    events = _load_json(EVENT_LOG_PATH, [])
    events.append(event)
    _write_json(EVENT_LOG_PATH, events)

    scorecard = _load_json(SCORECARD_PATH, {})
    uid = event.get("user_id")
    action = event.get("action")
    user_scores = scorecard.get(uid, {"belief_level": 0, "loyalty": 0, "impact_score": 0})

    increments = ACTION_VALUE_MAP.get(action, {})
    for key, inc in increments.items():
        user_scores[key] = user_scores.get(key, 0) + inc

    belief = event.get("belief")
    if belief:
        approved = validate_belief(uid, belief)
        _log_audit({"action": "belief_validation", "user_id": uid,
                    "belief": belief, "approved": approved})
        if approved:
            user_scores["belief_level"] = user_scores.get("belief_level", 0) + 1

    scorecard[uid] = user_scores
    _write_json(SCORECARD_PATH, scorecard)

    _log_audit({"event": event, "signals": _signals_from_increment(increments), "score": user_scores})

    check_thresholds(uid)
    return user_scores


def _signals_from_increment(increments):
    signals = []
    if "belief_level" in increments:
        signals.append("+belief_level")
    if "loyalty" in increments:
        signals.append("+community_signal")
    if increments.get("impact_score", 0) >= 3:
        signals.append("unlock_moral_bonus")
    return signals


def check_thresholds(user_id):
    """Check if user passes threshold and trigger ascension."""
    scorecard = _load_json(SCORECARD_PATH, {})
    metrics = scorecard.get(user_id, {})
    belief = metrics.get("belief_level", 0)
    loyalty = metrics.get("loyalty", 0)
    impact = metrics.get("impact_score", 0)
    if belief + loyalty + impact > THRESHOLD:
        log_vaultfire_status(identity="ascend_candidate", wallet=user_id)
        mark_yield_boost(user_id)
        _log_audit({"action": "threshold_met", "user_id": user_id})
        return True
    return False


# --- Future integrations -----------------------------------------------------

def sync_openai(user_id, event):
    """Placeholder for OpenAI reflection prompts."""
    pass


def sync_ns3(user_id, event):
    """Placeholder for NS3 quiz response mirror."""
    pass


def sync_worldcoin(user_id):
    """Placeholder for Worldcoin ID verification hook."""
    pass


def _log_audit(entry):
    log = _load_json(AUDIT_PATH, [])
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    entry_with_time = {"timestamp": timestamp, **entry}
    log.append(entry_with_time)
    _write_json(AUDIT_PATH, log)
    append_entry("audit_event", entry_with_time)


def belief_pulse(user_id):
    """Return a short status string representing user's belief alignment."""
    scorecard = _load_json(SCORECARD_PATH, {})
    metrics = scorecard.get(user_id, {})
    belief = metrics.get("belief_level", 0)
    loyalty = metrics.get("loyalty", 0)
    impact = metrics.get("impact_score", 0)
    total = belief + loyalty + impact

    audit = _load_json(AUDIT_PATH, [])
    for entry in audit:
        if entry.get("user_id") == user_id and entry.get("approved") is False:
            return "🚫 Ethics Breach"

    if total >= THRESHOLD * 2:
        return "🔥 On Fire"
    if total >= THRESHOLD:
        return "🧭 Aligned"
    return "😶 Drifted"


def update_heartbeat():
    """Collect belief pulse for all users and append to dashboard file."""
    scorecard = _load_json(SCORECARD_PATH, {})
    pulse = {uid: belief_pulse(uid) for uid in scorecard.keys()}
    pulse["timestamp"] = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

    log = _load_json(HEARTBEAT_PATH, [])
    log.append(pulse)
    _write_json(HEARTBEAT_PATH, log)
    return pulse


if __name__ == "__main__":
    update_heartbeat()
