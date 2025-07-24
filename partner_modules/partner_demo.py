from __future__ import annotations

"""Automated demo mode utilities."""

import json
from datetime import datetime, timedelta
from pathlib import Path

from .dynamic_kpi import record_event
from .multi_identity import link_wallet
from .verifiability_console import record_audit_log

BASE_DIR = Path(__file__).resolve().parents[1]
DEMO_PATH = BASE_DIR / "logs" / "partner_demo.json"


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


def start_demo(partner_id: str) -> dict:
    """Create demo instance for ``partner_id``."""
    demos = _load_json(DEMO_PATH, {})
    expires = datetime.utcnow() + timedelta(hours=48)
    test_user = f"{partner_id}_demo_user"
    demos[partner_id] = {
        "user": test_user,
        "created": datetime.utcnow().isoformat(),
        "expires": expires.isoformat(),
    }
    _write_json(DEMO_PATH, demos)
    link_wallet(test_user, f"{test_user}.wallet")
    record_audit_log({"partner_id": partner_id, "event": "demo_start"})
    return demos[partner_id]


def simulate_activity(partner_id: str) -> None:
    """Generate synthetic events for ``partner_id`` demo."""
    demos = _load_json(DEMO_PATH, {})
    info = demos.get(partner_id)
    if not info:
        return
    user = info["user"]
    record_event(partner_id, user, "wallet_connect")
    record_event(partner_id, user, "passive")
    record_event(partner_id, user, "quiz")
    record_event(partner_id, user, "drop_claim")


def walkthrough_steps() -> list:
    return [
        "Connect demo wallet",
        "View sample KPI dashboard",
        "Claim demo drop",
        "Explore passive yield",
    ]


def cleanup_expired() -> None:
    demos = _load_json(DEMO_PATH, {})
    now = datetime.utcnow()
    active = {k: v for k, v in demos.items() if datetime.fromisoformat(v["expires"]) > now}
    if active != demos:
        _write_json(DEMO_PATH, active)
