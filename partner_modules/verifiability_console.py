from __future__ import annotations

"""Utilities for partner verifiability logs and dashboard."""

import csv
import json
from datetime import datetime
from pathlib import Path

import psutil

BASE_DIR = Path(__file__).resolve().parents[1]
LOG_DIR = BASE_DIR / "logs"
DASH_DIR = BASE_DIR / "dashboards"

ONCHAIN_LOG = LOG_DIR / "verifiability_onchain.json"
OFFCHAIN_LOG = LOG_DIR / "verifiability_offchain.json"
BUG_LOG = LOG_DIR / "bug_checks.json"
TEST_LOG = LOG_DIR / "module_tests.json"
UPTIME_PATH = LOG_DIR / "uptime_status.json"
CSV_EXPORT = DASH_DIR / "verifiability_console.csv"
BADGE_DIR = DASH_DIR / "partner_badges"


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


def record_audit_log(entry: dict, onchain: bool = False) -> None:
    """Append ``entry`` to audit log."""
    log_path = ONCHAIN_LOG if onchain else OFFCHAIN_LOG
    log = _load_json(log_path, [])
    log.append({"timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"), **entry})
    _write_json(log_path, log)


def get_audit_logs(onchain: bool | None = None) -> list:
    """Return stored audit logs."""
    if onchain is True:
        return _load_json(ONCHAIN_LOG, [])
    if onchain is False:
        return _load_json(OFFCHAIN_LOG, [])
    return _load_json(ONCHAIN_LOG, []) + _load_json(OFFCHAIN_LOG, [])


def log_bug_check(module: str, passed: bool, notes: str = "") -> None:
    """Record bug check results for ``module``."""
    log = _load_json(BUG_LOG, [])
    log.append({
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "module": module,
        "passed": passed,
        "notes": notes,
    })
    _write_json(BUG_LOG, log)


def uptime_status() -> dict:
    """Return system uptime in seconds."""
    uptime = int(datetime.utcnow().timestamp() - psutil.boot_time())
    status = {"uptime_seconds": uptime}
    _write_json(UPTIME_PATH, status)
    return status


def record_test_result(module: str, passed: bool) -> None:
    """Store module test results."""
    log = _load_json(TEST_LOG, [])
    log.append({
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "module": module,
        "passed": passed,
    })
    _write_json(TEST_LOG, log)


def export_dashboard_csv() -> Path:
    """Export audit logs and bug checks to CSV."""
    rows = []
    for entry in get_audit_logs(None):
        rows.append((entry["timestamp"], "audit", json.dumps(entry)))
    for entry in _load_json(BUG_LOG, []):
        rows.append((entry["timestamp"], "bug", json.dumps(entry)))
    for entry in _load_json(TEST_LOG, []):
        rows.append((entry["timestamp"], "test", json.dumps(entry)))
    with open(CSV_EXPORT, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["timestamp", "type", "data"])
        for row in rows:
            writer.writerow(row)
    return CSV_EXPORT


def badge_certificate(partner_id: str) -> Path:
    """Generate a simple text badge certificate."""
    BADGE_DIR.mkdir(parents=True, exist_ok=True)
    path = BADGE_DIR / f"{partner_id}_badge.txt"
    path.write_text(f"Vaultfire Partner Verified: {partner_id}\n")
    return path
