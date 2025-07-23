"""AR mission utilities for belief-based scanning."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional

from .mission_scheduler import record_reward

BASE_DIR = Path(__file__).resolve().parents[1]
MARKERS_PATH = BASE_DIR / "logs" / "ar_markers.json"
SCANS_PATH = BASE_DIR / "logs" / "ar_scans.json"


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
# Marker Registry
# ---------------------------------------------------------------------------

def register_marker(marker_id: str, belief_text: str, reward: int = 1) -> Dict:
    """Register a real-world marker with optional reward."""
    markers = _load_json(MARKERS_PATH, {})
    markers[marker_id] = {"belief": belief_text, "reward": reward}
    _write_json(MARKERS_PATH, markers)
    return markers[marker_id]


def scan_marker(user_id: str, marker_id: str) -> Optional[Dict]:
    """Record that ``user_id`` scanned ``marker_id``."""
    markers = _load_json(MARKERS_PATH, {})
    marker = markers.get(marker_id)
    if not marker:
        return None
    scans = _load_json(SCANS_PATH, [])
    entry = {
        "user": user_id,
        "marker": marker_id,
        "time": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    scans.append(entry)
    _write_json(SCANS_PATH, scans)
    record_reward(user_id, "ar_mission", marker.get("reward", 1))
    return entry


__all__ = ["register_marker", "scan_marker"]
