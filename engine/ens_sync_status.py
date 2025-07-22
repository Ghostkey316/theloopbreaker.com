# Reference: ethics/core.mdx
"""ENS sync status helper."""

import json
from pathlib import Path
from typing import Dict

from .identity_resolver import resolve_ens

BASE_DIR = Path(__file__).resolve().parents[1]
SCORECARD_PATH = BASE_DIR / "user_scorecard.json"
AUDIT_PATH = BASE_DIR / "logs" / "sync_audit.json"


def _load_json(path: Path, default):
    if path.exists():
        try:
            with open(path) as f:
                return json.load(f)
        except json.JSONDecodeError:
            return default
    return default


def read_sync_status(ens_name: str) -> Dict:
    """Return latest sync audit entry for ``ens_name``."""
    scorecard = _load_json(SCORECARD_PATH, {})
    user_id = None
    for uid, info in scorecard.items():
        if info.get("wallet", "").lower() == ens_name.lower():
            user_id = uid
            break
    if user_id is None:
        address = resolve_ens(ens_name)
        for uid, info in scorecard.items():
            if info.get("wallet", "").lower() == (address or "").lower():
                user_id = uid
                break
    if user_id is None:
        return {}

    audit_log = _load_json(AUDIT_PATH, [])
    entries = [e for e in audit_log if e.get("user_id") == user_id]
    if not entries:
        return {}
    entries.sort(key=lambda x: x.get("timestamp", ""))
    return entries[-1]
