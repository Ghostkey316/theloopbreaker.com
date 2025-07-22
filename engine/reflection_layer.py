from __future__ import annotations

"""Reflection layer for tracking user emotions over time."""

import json
import hashlib
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Dict, List

from .health_sync_engine import encrypt_data, decrypt_data

BASE_DIR = Path(__file__).resolve().parents[1]
EMOTION_DIR = BASE_DIR / "logs" / "emotion_state"

# simple keyword mapping for lightweight emotion tagging
EMOTION_KEYWORDS: Dict[str, set[str]] = {
    "joy": {"joy", "happy", "glad", "delighted", "grateful"},
    "fear": {"afraid", "fear", "scared", "terrified"},
    "doubt": {"doubt", "unsure", "uncertain", "confused"},
    "confidence": {"confident", "assured", "certain", "bold"},
}


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


def _hash_id(identifier: str) -> str:
    return hashlib.sha256(identifier.encode()).hexdigest()


def tag_emotion(text: str) -> str:
    """Return a basic emotion label from ``text``."""
    text = text.lower()
    scores: Dict[str, int] = {}
    for label, words in EMOTION_KEYWORDS.items():
        scores[label] = sum(1 for w in words if w in text)
    if not scores:
        return "neutral"
    label = max(scores, key=scores.get)
    return label if scores[label] > 0 else "neutral"


def update_emotional_state(user_id: str, text: str, key: str) -> List[Dict]:
    """Analyze ``text`` and append encrypted emotion record."""
    hashed = _hash_id(user_id)
    path = EMOTION_DIR / f"{hashed}.json"
    data = _load_json(path, {"entries": []})
    entries_enc = data.get("entries", [])
    entries: List[Dict] = []
    for token in entries_enc:
        try:
            entry_text = decrypt_data(token, key)
            ts, emo = entry_text.split("|", 1)
            entries.append({"timestamp": ts, "emotion": emo})
        except Exception:
            continue
    emotion = tag_emotion(text)
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    token = encrypt_data(f"{timestamp}|{emotion}", key)
    entries_enc.append(token)
    _write_json(path, {"entries": entries_enc})
    entries.append({"timestamp": timestamp, "emotion": emotion})
    return entries


def emotion_trend(user_id: str, key: str, window: int = 10) -> Dict[str, float]:
    """Return distribution of emotions for ``user_id``."""
    hashed = _hash_id(user_id)
    path = EMOTION_DIR / f"{hashed}.json"
    data = _load_json(path, {"entries": []})
    counts: Counter[str] = Counter()
    for token in data.get("entries", [])[-window:]:
        try:
            entry_text = decrypt_data(token, key)
            _, emo = entry_text.split("|", 1)
            counts[emo] += 1
        except Exception:
            continue
    total = sum(counts.values())
    if total == 0:
        return {}
    return {e: counts[e] / total for e in counts}


__all__ = ["update_emotional_state", "emotion_trend", "tag_emotion"]
