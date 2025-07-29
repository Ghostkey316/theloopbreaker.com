"""Simulated reward router for Vaultfire belief forks."""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

LOG_PATH = Path('rewards_log.json')
TX_PATH = Path('simulated_tx.json')
MEMORY_PATH = Path('memory_log.json')

ETHICS_WORDS = ["truth", "loyalty", "wisdom", "service", "humanity"]

_reward_router: List[Dict[str, Any]] = []


def _load_json(path: Path, default):
    if path.exists():
        try:
            with open(path) as f:
                return json.load(f)
        except json.JSONDecodeError:
            return default
    return default


def _write_json(path: Path, data) -> None:
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def _append(path: Path, entry: Dict[str, Any]) -> None:
    data = _load_json(path, [])
    data.append(entry)
    _write_json(path, data)


def _vectorize(text: str, words: List[str]) -> List[int]:
    tokens = [t.lower() for t in text.split()]
    return [tokens.count(w) for w in words]


def _cosine(a: List[int], b: List[int]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    mag_a = sum(x * x for x in a) ** 0.5
    mag_b = sum(x * x for x in b) ** 0.5
    if not mag_a or not mag_b:
        return 0.0
    return dot / (mag_a * mag_b)


def _alignment(entries: List[Dict[str, Any]]) -> float:
    text = " ".join(json.dumps(e) for e in entries)
    vec = _vectorize(text, ETHICS_WORDS)
    ref = [1] * len(ETHICS_WORDS)
    return _cosine(vec, ref)


def process_rewards(wallet: str) -> List[Dict[str, Any]]:
    mem = _load_json(MEMORY_PATH, [])
    results: List[Dict[str, Any]] = []
    existing = {(e.get("ghost_id"), e.get("wallet")) for e in _load_json(LOG_PATH, [])}
    by_ghost: Dict[str, List[Dict[str, Any]]] = {}
    for entry in mem:
        by_ghost.setdefault(entry.get("ghost_id"), []).append(entry)
    for gid, entries in by_ghost.items():
        score = _alignment(entries)
        milestone = any(e.get("action") == "belief_milestone" for e in entries)
        if score >= 0.75 or milestone:
            if (gid, wallet) in existing:
                continue
            reward = {
                "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
                "ghost_id": gid,
                "wallet": wallet,
                "amount": 1,
                "score": round(score, 3),
            }
            _append(LOG_PATH, reward)
            tx = {
                "wallet": wallet,
                "token": "LOYAL",
                "amount": 1,
                "ghost_id": gid,
                "timestamp": reward["timestamp"],
            }
            _append(TX_PATH, tx)
            _reward_router.append(reward)
            results.append(reward)
    return results


if __name__ == "__main__":
    import sys

    wallet = sys.argv[1] if len(sys.argv) > 1 else "demo.cb.id"
    out = process_rewards(wallet)
    print(json.dumps(out, indent=2))
