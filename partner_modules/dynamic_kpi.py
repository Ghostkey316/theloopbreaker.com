from __future__ import annotations

"""Partner KPI tracking utilities."""

import json
from collections import defaultdict
from datetime import datetime
from pathlib import Path

from .verifiability_console import record_audit_log

BASE_DIR = Path(__file__).resolve().parents[1]
KPI_LOG = BASE_DIR / "logs" / "partner_kpi_events.json"
KPI_DASH = BASE_DIR / "dashboards" / "partner_kpi.json"


# ---------------------------------------------------------------------------


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


def record_event(partner_id: str, user_id: str, event: str) -> None:
    """Record KPI ``event`` for ``user_id``."""
    log = _load_json(KPI_LOG, [])
    log.append({
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "partner_id": partner_id,
        "user_id": user_id,
        "event": event,
    })
    _write_json(KPI_LOG, log)
    record_audit_log({"partner_id": partner_id, "kpi_event": event})


def _aggregate(log: list, redact: bool) -> dict:
    days = defaultdict(set)
    metrics = defaultdict(int)
    for entry in log:
        uid = entry.get("user_id") if not redact else "*"
        day = entry.get("timestamp", "").split("T")[0]
        event = entry.get("event")
        days[day].add(uid)
        metrics[event] += 1
    dau = max(len(users) for users in days.values()) if days else 0
    retention = sum(len(users) for users in days.values()) / (len(days) or 1)
    dashboard = {
        "dau": dau,
        "retention": round(retention, 2),
        "referrals": metrics.get("referral", 0),
        "rewards": metrics.get("reward", 0),
        "passive_usage": metrics.get("passive", 0),
        "compass": metrics.get("compass", 0),
    }
    return dashboard


def generate_dashboard(partner_id: str, redact: bool = False) -> dict:
    log = [e for e in _load_json(KPI_LOG, []) if e.get("partner_id") == partner_id]
    dash = _aggregate(log, redact)
    store = _load_json(KPI_DASH, {})
    store[partner_id] = dash
    _write_json(KPI_DASH, store)
    return dash
