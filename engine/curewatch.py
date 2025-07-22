"""Monitor healing submissions for high-effectiveness patterns.

This module flags recurring treatment methods with strong trust scores and
notifies governance under a 'CureWatch' tag.
"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List

BASE_DIR = Path(__file__).resolve().parents[1]
REPORTS_PATH = BASE_DIR / "knowledge_repo" / "data" / "healing_reports.json"
NOTIFY_PATH = BASE_DIR / "governance" / "curewatch_notifications.json"


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


def _trust_score(entry: Dict) -> float:
    reports = entry.get("verified_reports", 0)
    consistency = entry.get("consistent_results", 0.0)
    non_commercial = 0.1 if entry.get("non_commercial_backing") else 0.0
    score = reports * 0.5 + consistency * 0.4 + non_commercial
    return round(score, 2)


def flag_effective_patterns(min_reports: int = 2, threshold: float = 5.0) -> List[Dict]:
    """Return flagged methods that exceed ``threshold`` trust on ``min_reports`` submissions."""
    data = _load_json(REPORTS_PATH, [])
    methods: Dict[str, List[float]] = {}
    for item in data:
        method = item.get("method")
        if not method:
            continue
        methods.setdefault(method, []).append(_trust_score(item))

    flags = []
    for method, scores in methods.items():
        if len(scores) >= min_reports:
            avg_score = sum(scores) / len(scores)
            if avg_score >= threshold:
                flags.append({"method": method, "count": len(scores), "avg_score": round(avg_score, 2)})

    if not flags:
        return []

    log = _load_json(NOTIFY_PATH, [])
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    for entry in flags:
        log.append({"timestamp": timestamp, "tag": "CureWatch", **entry})
    _write_json(NOTIFY_PATH, log)
    return flags


if __name__ == "__main__":
    print(json.dumps(flag_effective_patterns(), indent=2))
