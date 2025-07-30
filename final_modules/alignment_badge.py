"""Proof-of-Alignment Badge System.

Generates simple badge records for users and partners who follow the
Ghostkey Ethics Framework. Badges are stored as JSON entries and can
be used to unlock perks in the wider ecosystem.
"""
from __future__ import annotations

from pathlib import Path
from datetime import datetime

from utils.json_io import load_json, write_json

BADGE_PATH = Path(__file__).resolve().parent / "badges.json"




def issue_badge(user_id: str, tier: str) -> dict:
    badges = load_json(BADGE_PATH, {})
    badge = {
        "tier": tier,
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    badges[user_id] = badge
    write_json(BADGE_PATH, badges)
    return badge


__all__ = ["issue_badge"]
