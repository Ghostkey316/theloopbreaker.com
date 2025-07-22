"""AI Archetype Mirror for custom guides."""

from __future__ import annotations

import json
from pathlib import Path
from datetime import datetime
from typing import Dict, List

from .purpose_engine import moral_memory_mirror
from .soul_journal import get_entries, get_soulprint
from .belief_validation import get_user_checkpoints

BASE_DIR = Path(__file__).resolve().parents[1]
GUIDE_PATH = BASE_DIR / "logs" / "archetype_guides.json"


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


# ---------------------------------------------------------------------------


def _writing_style(entries: List[Dict]) -> Dict[str, float | int]:
    if not entries:
        return {"avg_words": 0.0, "unique_words": 0}
    words = []
    for e in entries:
        text = e.get("text", "")
        words.extend(text.split())
    avg_words = len(words) / len(entries)
    unique_words = len(set(w.lower() for w in words))
    return {"avg_words": round(avg_words, 2), "unique_words": unique_words}


# ---------------------------------------------------------------------------


def train_archetype_guide(user_id: str) -> Dict:
    """Generate or update the archetype guide for ``user_id``."""
    fingerprint = moral_memory_mirror(user_id)
    entries = get_entries(user_id)
    style = _writing_style(entries)
    soulprint = get_soulprint(user_id)

    checkpoints = get_user_checkpoints(user_id)
    beliefs = [c.get("belief") for c in checkpoints if c.get("approved")][-5:]

    guide = {
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "fingerprint": fingerprint,
        "style": style,
        "beliefs": beliefs,
        "soulprint": soulprint,
    }

    data = _load_json(GUIDE_PATH, {})
    data[user_id] = guide
    _write_json(GUIDE_PATH, data)
    return guide


def get_archetype_guide(user_id: str) -> Dict | None:
    """Return stored archetype guide for ``user_id`` if available."""
    data = _load_json(GUIDE_PATH, {})
    return data.get(user_id)


__all__ = ["train_archetype_guide", "get_archetype_guide"]

