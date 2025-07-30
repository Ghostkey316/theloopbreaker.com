"""Multi-Domain Risk Mirror.

Models potential misuse across biological, digital, and social domains.
"""
from __future__ import annotations

from pathlib import Path
from typing import Dict

from utils.json_io import load_json, write_json

from engine.ethical_growth_engine import ethics_passed

BASE_DIR = Path(__file__).resolve().parent
LOG_PATH = BASE_DIR / "risk_mirror_log.json"

REPLACEMENTS = {
    "Threat mirror engine": "Resilience simulation core",
    "Antivirus suggestions": "Mitigation strategy output",
    "Rogue signals": "anomalous behaviors",
}




def sanitize_terms(text: str) -> str:
    for old, new in REPLACEMENTS.items():
        text = text.replace(old, new)
    return text


def model_misuse(domain: str, scenario: str, user_id: str | None = None) -> dict:
    """Record a sanitized misuse scenario for review."""
    if user_id and not ethics_passed(user_id):
        return {"status": "denied"}
    sanitized = sanitize_terms(scenario)
    log = load_json(LOG_PATH, [])
    entry = {"domain": domain, "scenario": sanitized}
    log.append(entry)
    write_json(LOG_PATH, log[-100:])
    return entry


__all__ = ["sanitize_terms", "model_misuse", "LOG_PATH"]
