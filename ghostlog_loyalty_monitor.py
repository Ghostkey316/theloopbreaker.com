"""Monitor loyalty ranks and log Ghostkey-316 updates."""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from engine.loyalty_engine import update_loyalty_ranks

BASE_DIR = Path(__file__).resolve().parent
LOG_PATH = BASE_DIR / "logs" / "ghostlog_loyalty.json"


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


def monitor() -> dict:
    ranks = update_loyalty_ranks()
    ghost = next((r for r in ranks if r.get("user_id") == "ghostkey316"), None)
    entry = {
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "ghostkey316": ghost,
    }
    log = _load_json(LOG_PATH, [])
    log.append(entry)
    _write_json(LOG_PATH, log)
    return entry


if __name__ == "__main__":
    print(json.dumps(monitor(), indent=2))
