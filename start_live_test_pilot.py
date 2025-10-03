#!/usr/bin/env python3
"""CLI entrypoint to launch the Vaultfire live test pilot."""
from __future__ import annotations

import argparse
import os
import sys

import uvicorn

os.environ.setdefault("VAULTFIRE_SANDBOX_MODE", "1")

from live_test_pilot.api import create_app
from live_test_pilot.config import load_config
from live_test_pilot.telemetry import telemetry_manager


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Start the Vaultfire live pilot sandbox")
    parser.add_argument("--host", default="0.0.0.0", help="Host interface to bind (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8080, help="Port to serve the API (default: 8080)")
    parser.add_argument("--log-level", default="info", help="Uvicorn log level")
    parser.add_argument(
        "--force", action="store_true", help="Override live_test_flag guard (for CI synthetic validation)"
    )
    parser.add_argument(
        "--metrics-interval", type=int, help="Override telemetry export interval in seconds"
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    config = load_config()

    if not config.live_test_flag and not args.force:
        sys.stderr.write("Live test flag disabled. Enable live_test_flag in vaultfire_config.json or pass --force.\n")
        return 2

    if args.metrics_interval:
        telemetry_manager.configure_interval(args.metrics_interval)

    app = create_app(config=config, telemetry=telemetry_manager)
    telemetry_manager.record_event(
        "cli_boot",
        {
            "host": args.host,
            "port": args.port,
            "force": args.force,
            "metrics_interval": args.metrics_interval or config.telemetry_interval_seconds,
        },
    )
    uvicorn.run(app, host=args.host, port=args.port, log_level=args.log_level)
    telemetry_manager.record_event("cli_shutdown", {"host": args.host, "port": args.port})
    telemetry_manager.shutdown()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
