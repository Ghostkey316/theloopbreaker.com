from __future__ import annotations

import json
import hashlib
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List

BASE_DIR = Path(__file__).resolve().parents[1]
JOURNAL_DIR = BASE_DIR / "journals"


def _load_journal(user_id: str) -> Dict:
    path = JOURNAL_DIR / f"{user_id}.json"
    if path.exists():
        try:
            with open(path) as f:
                return json.load(f)
        except json.JSONDecodeError:
            pass
    return {"entries": [], "soulprint": ""}


def _write_journal(user_id: str, data: Dict) -> None:
    JOURNAL_DIR.mkdir(parents=True, exist_ok=True)
    path = JOURNAL_DIR / f"{user_id}.json"
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def _compute_soulprint(entries: List[Dict]) -> str:
    blob = json.dumps(entries, sort_keys=True).encode()
    return hashlib.sha256(blob).hexdigest()


def add_entry(user_id: str, text: str) -> str:
    """Append ``text`` with timestamp to ``user_id``'s journal.

    Returns the updated soulprint.
    """
    data = _load_journal(user_id)
    data.setdefault("entries", [])
    data["entries"].append({
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "text": text,
    })
    data["soulprint"] = _compute_soulprint(data["entries"])
    _write_journal(user_id, data)
    return data["soulprint"]


def get_entries(user_id: str) -> List[Dict]:
    return _load_journal(user_id).get("entries", [])


def get_soulprint(user_id: str) -> str:
    return _load_journal(user_id).get("soulprint", "")


def has_active_soulprint(user_id: str, days: int = 30) -> bool:
    """Return ``True`` if ``user_id`` has a journal entry within ``days`` days."""
    entries = get_entries(user_id)
    if not entries:
        return False
    try:
        last = entries[-1]["timestamp"]
        t = datetime.strptime(last, "%Y-%m-%dT%H:%M:%SZ")
    except Exception:
        return False
    return datetime.utcnow() - t <= timedelta(days=days)
