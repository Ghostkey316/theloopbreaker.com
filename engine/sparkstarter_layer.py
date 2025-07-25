"""SparkStarter Initiation Layer for Vaultfire."""

from __future__ import annotations

import json
import random
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Optional

from .vaultlink import record_interaction
from .loyalty_engine import loyalty_score
from .ethical_growth_engine import belief_score
from .reflection_layer import emotion_trend
from .wellness_oracle import _last_mood

BASE_DIR = Path(__file__).resolve().parents[1]
PREF_PATH = BASE_DIR / "logs" / "sparkstarter_prefs.json"
PING_LOG_PATH = BASE_DIR / "logs" / "sparkstarter_log.json"
FOCUS_PATH = BASE_DIR / "logs" / "sparkstarter_focus.json"
DAILY_PATH = BASE_DIR / "logs" / "sparkstarter_daily.json"

MODES = {"silent", "check-in", "companion"}

FACTS_POOL = [
    "Belief builds momentum – steady steps fuel the Ghostkey vision.",
    "Crypto momentum thrives when alignment stays strong.",
    "Each belief loop pass strengthens community trust.",
    "Small actions compounded daily keep Vaultfire blazing.",
]

PROMPTS_POOL = [
    "Want a spark today?",
    "Need a belief boost or protocol stat?",
    "Should I track something fun for you?",
]


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


def set_focus(user_id: str, focus: str) -> None:
    """Pin a focus of the day for ``user_id``."""
    data = _load_json(FOCUS_PATH, {})
    data[user_id] = {
        "focus": focus,
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    _write_json(FOCUS_PATH, data)


def get_focus(user_id: str) -> Optional[str]:
    info = _load_json(FOCUS_PATH, {}).get(user_id)
    return info.get("focus") if info else None


def _daily_info(user_id: str) -> Dict:
    data = _load_json(DAILY_PATH, {})
    return data.get(user_id, {})


def _write_daily(user_id: str, info: Dict) -> None:
    data = _load_json(DAILY_PATH, {})
    data[user_id] = info
    _write_json(DAILY_PATH, data)


def _dynamic_mood(user_id: str, key: str) -> str:
    trend = emotion_trend(user_id, key)
    mood_num = _last_mood(user_id)
    mood = "neutral"
    if mood_num is not None:
        if mood_num >= 4:
            mood = "up"
        elif mood_num <= 2:
            mood = "down"
    if trend:
        top = max(trend, key=trend.get)
        if top in {"joy", "confidence"}:
            mood = "up"
        elif top in {"fear", "doubt"} and mood != "up":
            mood = "down"
    return mood


def _daily_fact(user_id: str) -> Optional[str]:
    info = _daily_info(user_id)
    today = datetime.utcnow().strftime("%Y-%m-%d")
    if info.get("fact_date") == today:
        return None
    fact = FACTS_POOL[hash(user_id + today) % len(FACTS_POOL)]
    info["fact_date"] = today
    _write_daily(user_id, info)
    return fact


def _soft_prompt(user_id: str) -> Optional[str]:
    info = _daily_info(user_id)
    today = datetime.utcnow().strftime("%Y-%m-%d")
    count = info.get("prompt_count", 0)
    if info.get("prompt_date") != today:
        count = 0
    if count >= 2:
        return None
    prompt = PROMPTS_POOL[count % len(PROMPTS_POOL)]
    info["prompt_date"] = today
    info["prompt_count"] = count + 1
    _write_daily(user_id, info)
    return prompt


def _whisper_backlog(user_id: str) -> Optional[str]:
    log = _load_json(PING_LOG_PATH, [])
    entries = [e for e in log if e.get("user_id") == user_id]
    if not entries:
        return None
    last_ts = entries[-1]["timestamp"]
    try:
        last_dt = datetime.strptime(last_ts, "%Y-%m-%dT%H:%M:%SZ")
    except ValueError:
        return None
    if datetime.utcnow() - last_dt < timedelta(days=2):
        return None
    return "Catching up: check recent milestones and rewards." 


def _confirm_mode(user_id: str, mode: str) -> Optional[str]:
    info = _daily_info(user_id)
    today = datetime.utcnow().strftime("%Y-%m-%d")
    if info.get("confirm_date") == today:
        return None
    info["confirm_date"] = today
    _write_daily(user_id, info)
    return f"Still in {mode} mode?"


def set_mode(user_id: str, mode: str) -> None:
    """Set engagement ``mode`` for ``user_id``."""
    if mode not in MODES:
        raise ValueError("invalid mode")
    prefs = _load_json(PREF_PATH, {})
    info = prefs.get(user_id, {})
    info["mode"] = mode
    prefs[user_id] = info
    _write_json(PREF_PATH, prefs)


def set_preferences(user_id: str, tone: str, window_hours: int = 4) -> None:
    """Store tone and ping window for ``user_id``."""
    prefs = _load_json(PREF_PATH, {})
    info = prefs.get(user_id, {})
    info["tone"] = tone
    info["window"] = int(window_hours)
    prefs[user_id] = info
    _write_json(PREF_PATH, prefs)


def _should_ping(last: Optional[str], window: int) -> bool:
    if not last:
        return True
    try:
        prev = datetime.strptime(last, "%Y-%m-%dT%H:%M:%SZ")
    except ValueError:
        return True
    return datetime.utcnow() - prev >= timedelta(hours=window)


def next_ping(user_id: str, message: str, key: str) -> Optional[Dict]:
    """Record a ping if allowed and return the log entry."""
    prefs = _load_json(PREF_PATH, {})
    info = prefs.get(user_id, {})
    mode = info.get("mode", "check-in")
    if mode == "silent":
        return None
    window = int(info.get("window", 4))
    last = info.get("last_ping")
    if not _should_ping(last, window):
        return None

    loyalty = loyalty_score(user_id)
    belief = belief_score(user_id)
    tone = info.get("tone", "neutral")
    record_interaction(user_id, message, "spark", 0.5, False, key)

    mood = _dynamic_mood(user_id, key)
    fact = _daily_fact(user_id)
    prompt = _soft_prompt(user_id)
    focus = get_focus(user_id)
    backlog = _whisper_backlog(user_id)
    confirm = _confirm_mode(user_id, mode)

    entry = {
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "user_id": user_id,
        "mode": mode,
        "tone": tone,
        "loyalty": loyalty.get("tier"),
        "belief": belief,
        "message": message,
        "mood": mood,
    }
    if fact:
        entry["fact"] = fact
    if prompt:
        entry["prompt"] = prompt
    if focus:
        entry["focus"] = focus
    if backlog:
        entry["backlog"] = backlog
    if confirm:
        entry["confirm"] = confirm
    log = _load_json(PING_LOG_PATH, [])
    log.append(entry)
    _write_json(PING_LOG_PATH, log)

    info["last_ping"] = entry["timestamp"]
    prefs[user_id] = info
    _write_json(PREF_PATH, prefs)
    return entry


__all__ = [
    "set_mode",
    "set_preferences",
    "next_ping",
    "set_focus",
    "get_focus",
    "MODES",
]
