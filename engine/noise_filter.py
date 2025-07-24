from __future__ import annotations
import json
from pathlib import Path

import asyncio

from vaultfire_signal_parser import parse_signal
from engine.ghostscore_engine import get_ghostscore

BASE_DIR = Path(__file__).resolve().parents[1]
FEED_PATH = BASE_DIR / "dashboards" / "signal_feed.json"
FILTERED_PATH = BASE_DIR / "dashboards" / "signal_filtered.json"
AUDIT_PATH = BASE_DIR / "logs" / "noise_filter_audit.json"
LEARNING_PATH = BASE_DIR / "logs" / "signal_quality_learning.json"


def _classify(score: int, belief_intensity: int) -> str:
    if belief_intensity < -2 or score <= 10:
        return "malicious"
    if score >= 80:
        return "signal"
    if score >= 60:
        return "contribution"
    if score >= 40:
        return "surface"
    if score >= 20:
        return "noise"
    return "malicious"


def record_manual_tag(tag: str) -> None:
    data = _load_json(LEARNING_PATH, {})
    data[tag] = data.get(tag, 0) + 1
    _write_json(LEARNING_PATH, data)


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


def _score_entry(entry: dict) -> tuple[int, str]:
    text = json.dumps(entry, sort_keys=True)
    parsed = parse_signal(text)
    base = parsed.get("score", 0)
    user = entry.get("user") or entry.get("identity")
    if user:
        base += int(get_ghostscore(str(user)) / 10)
    category = _classify(base, parsed.get("belief_intensity", 0))
    return base, category


def filter_feed(threshold: int = 30, ghostkey_vision: bool = False) -> list[dict]:
    """Filter signal feed and write results."""
    feed = _load_json(FEED_PATH, [])
    filtered = []
    audit = []
    for item in feed:
        score, category = _score_entry(item)
        item["signal_score"] = score
        item["category"] = category
        user = item.get("user") or item.get("identity")
        trusted = user and get_ghostscore(str(user)) >= 100
        if score < threshold and not trusted:
            item["suppressed"] = True
            if ghostkey_vision:
                item["filter_reason"] = "low score"
                filtered.append(item)
            audit.append({
                "timestamp": item.get("timestamp"),
                "reason": "low score",
                "score": score,
                "category": category,
            })
        else:
            filtered.append(item)
    _write_json(FILTERED_PATH, filtered)
    if audit:
        log = _load_json(AUDIT_PATH, [])
        log.extend(audit)
        _write_json(AUDIT_PATH, log)
    return filtered


async def filter_feed_async(threshold: int = 30, ghostkey_vision: bool = False) -> list[dict]:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, filter_feed, threshold, ghostkey_vision)


if __name__ == "__main__":
    asyncio.run(filter_feed_async())
