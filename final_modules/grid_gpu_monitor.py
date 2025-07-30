"""Grid + GPU Load Monitor.

Tracks energy demand and compute stress points. Outputs summaries
for dashboards and CLI tools.
"""
from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Dict

from engine.ethical_growth_engine import ethics_passed

from utils.json_io import load_json, write_json

BASE_DIR = Path(__file__).resolve().parent
LOG_PATH = BASE_DIR / "grid_gpu_load.json"




def log_system_snapshot(
    grid_gw: float,
    gpu_available: float,
    cooling_c: float,
    zone: str,
    user_id: str | None = None,
) -> dict:
    """Record a compute load snapshot."""
    if user_id and not ethics_passed(user_id):
        return {"status": "blocked"}
    log = load_json(LOG_PATH, [])
    entry = {
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "grid_gw": grid_gw,
        "gpu_available": gpu_available,
        "cooling_c": cooling_c,
        "zone": zone,
    }
    log.append(entry)
    write_json(LOG_PATH, log[-50:])
    return entry


def summarize_state() -> dict:
    """Return averaged load metrics."""
    log = load_json(LOG_PATH, [])
    if not log:
        return {}
    avg_grid = sum(e["grid_gw"] for e in log) / len(log)
    avg_gpu = sum(e["gpu_available"] for e in log) / len(log)
    zones: Dict[str, dict] = {}
    for e in log:
        z = zones.setdefault(e["zone"], {"max_cooling": e["cooling_c"], "count": 0})
        z["max_cooling"] = max(z["max_cooling"], e["cooling_c"])
        z["count"] += 1
    return {
        "avg_grid_gw": round(avg_grid, 3),
        "avg_gpu_available": round(avg_gpu, 3),
        "heat_zones": zones,
    }


__all__ = ["log_system_snapshot", "summarize_state", "LOG_PATH"]
