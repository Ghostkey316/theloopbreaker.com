from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

BASE_DIR = Path(__file__).resolve().parents[1]
MIRROR_DIR = BASE_DIR / "logs" / "partner_mirror"


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


def mirror_update(partner_id: str, traits: Optional[List[str]] = None,
                  beliefs: Optional[List[str]] = None) -> Dict:
    """Mirror trait and belief updates for ``partner_id``."""
    path = MIRROR_DIR / f"{partner_id}.json"
    record = _load_json(path, {"traits": [], "beliefs": []})
    if traits:
        existing = set(record.get("traits", []))
        for t in traits:
            if t not in existing:
                record.setdefault("traits", []).append(t)
                existing.add(t)
    if beliefs:
        existing = set(record.get("beliefs", []))
        for b in beliefs:
            if b not in existing:
                record.setdefault("beliefs", []).append(b)
                existing.add(b)
    record["timestamp"] = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    _write_json(path, record)
    return record


__all__ = ["mirror_update"]
