import json
import os
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
LORE_PATH = BASE_DIR / "lore_vault.json"


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
    os.chmod(path, 0o600)


def log_event(ens: str, event: str, details: str) -> dict:
    """Append a lore entry to ``lore_vault.json`` and return it."""
    log = _load_json(LORE_PATH, [])
    entry = {
        "ens": ens,
        "event": event,
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "details": details,
    }
    log.append(entry)
    _write_json(LORE_PATH, log)
    return entry


__all__ = ["log_event"]
