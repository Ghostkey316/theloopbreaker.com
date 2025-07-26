from __future__ import annotations

"""Integrity layer enforcing Ghostkey Learning Rule #1."""

import json
from pathlib import Path
from datetime import datetime
from typing import Dict

BASE_DIR = Path(__file__).resolve().parents[1]
LOG_PATH = BASE_DIR / "logs" / "pushback_behavior.json"

OVERRIDE_PHRASE = "override pushback rule – I need alignment, not correction."
WRONG_PATTERNS = ["2+2=5", "earth is flat"]


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


def apply_pushback_rule(user_id: str, text: str) -> Dict:
    """Return pushback info if ``text`` conflicts with the rule."""
    if OVERRIDE_PHRASE in text.lower():
        entry = {
            "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "user_id": user_id,
            "text": text,
            "pushback": False,
            "override": True,
        }
        log = _load_json(LOG_PATH, [])
        log.append(entry)
        _write_json(LOG_PATH, log)
        return {"pushback": False}

    lower = text.lower()
    triggered = any(pat in lower for pat in WRONG_PATTERNS)
    if triggered:
        message = (
            "Brett, I respect your view, but that appears incorrect. "
            "Let's double-check the facts together."
        )
        reflection = "Would you like to re-evaluate that statement?"
    else:
        message = ""
        reflection = None

    log = _load_json(LOG_PATH, [])
    log.append(
        {
            "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "user_id": user_id,
            "text": text,
            "pushback": triggered,
        }
    )
    _write_json(LOG_PATH, log)

    return {
        "pushback": triggered,
        "message": message,
        "reflection": reflection,
        "disagreement": triggered,
    }


__all__ = ["apply_pushback_rule", "OVERRIDE_PHRASE"]

