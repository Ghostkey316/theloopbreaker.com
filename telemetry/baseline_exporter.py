"""Generate baseline telemetry metrics from pilot activity logs."""

from __future__ import annotations

import json
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Iterable, Mapping


BASE_DIR = Path(__file__).resolve().parents[1]
LOG_PATH = BASE_DIR / "telemetry" / "belief-log.json"
OUTPUT_PATH = BASE_DIR / "telemetry" / "telemetry_baseline.json"


def _load_log(path: Path = LOG_PATH) -> Iterable[Mapping[str, object]]:
    if not path.exists():
        return []
    try:
        with path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
            if isinstance(data, list):
                return data
    except json.JSONDecodeError:
        return []
    return []


def _summarise(entries: Iterable[Mapping[str, object]]) -> dict:
    counter: Counter[str] = Counter()
    unique_wallets: set[str] = set()
    for entry in entries:
        if not isinstance(entry, Mapping):
            continue
        event = str(entry.get("event") or "unknown")
        counter[event] += 1
        wallet = entry.get("wallet") or entry.get("wallet_id")
        if wallet:
            unique_wallets.add(str(wallet))
    return {
        "events": counter,
        "unique_wallets": len(unique_wallets),
        "total_events": sum(counter.values()),
    }


def export_baseline(log_path: Path = LOG_PATH, output_path: Path = OUTPUT_PATH) -> dict:
    entries = list(_load_log(log_path))
    summary = _summarise(entries)
    baseline = {
        "generated_at": datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
        "source_log": str(log_path),
        "summary": {
            "unique_wallets": summary["unique_wallets"],
            "total_events": summary["total_events"],
            "events": dict(summary["events"]),
        },
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as handle:
        json.dump(baseline, handle, indent=2)
        handle.write("\n")
    return baseline


if __name__ == "__main__":
    export_baseline()

