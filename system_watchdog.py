"""Vaultfire system watchdog.

Monitors basic system metrics and verifies critical files
against the security baseline. Optionally repairs modified files.
"""
from __future__ import annotations

import argparse
import json
import time
from datetime import datetime
from pathlib import Path

try:
    import psutil  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    psutil = None

from security_monitor import check_integrity

BASE_DIR = Path(__file__).resolve().parent
LOG_DIR = BASE_DIR / "logs"
LOG_DIR.mkdir(exist_ok=True)
LOG_PATH = LOG_DIR / "system_watchdog.log"


def _log_entry(message: str) -> None:
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    with open(LOG_PATH, "a") as f:
        f.write(f"{timestamp} {message}\n")


def monitor(interval: int, repair: bool) -> None:
    """Continuously check system metrics and file integrity."""
    while True:
        metrics = {}
        if psutil is not None:
            metrics = {
                "cpu": psutil.cpu_percent(interval=0.1),
                "memory": psutil.virtual_memory().percent,
                "disk": psutil.disk_usage("/").percent,
            }
            _log_entry(json.dumps({"metrics": metrics}))
        incidents = check_integrity(repair=repair)
        for item in incidents:
            _log_entry(json.dumps({"incident": item}))
        time.sleep(interval)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run Vaultfire system watchdog")
    parser.add_argument("--interval", type=int, default=60,
                        help="Polling interval in seconds")
    parser.add_argument("--no-repair", action="store_true",
                        help="Disable automatic restoration")
    args = parser.parse_args(argv)

    try:
        monitor(args.interval, repair=not args.no_repair)
    except KeyboardInterrupt:
        return 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
