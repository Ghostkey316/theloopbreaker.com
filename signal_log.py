"""Simple signal logger."""
import json
from datetime import datetime
from pathlib import Path

LOG_PATH = Path("signal_events.json")


def log_signal(event: str, meta: dict | None = None) -> None:
    entry = {"event": event, "timestamp": datetime.utcnow().isoformat()}
    if meta:
        entry["meta"] = meta
    if LOG_PATH.exists():
        try:
            data = json.loads(LOG_PATH.read_text())
        except Exception:
            data = []
    else:
        data = []
    data.append(entry)
    LOG_PATH.write_text(json.dumps(data, indent=2))
