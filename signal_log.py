"""Simple signal logger with loop reference tracking."""
import json
from datetime import datetime
from pathlib import Path

from loop_reference_tracker import record_reference_from_event

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
    try:
        record_reference_from_event(event, meta)
    except Exception:
        # Reference tracking should never block baseline logging, so any
        # unexpected issue is swallowed silently.
        pass
