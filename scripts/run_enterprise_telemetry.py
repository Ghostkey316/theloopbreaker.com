#!/usr/bin/env python3
"""CLI helper to run the enterprise telemetry streamer."""

import argparse
import asyncio
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

from telemetry.enterprise_telemetry import TelemetryPipeline


async def _run(args: argparse.Namespace) -> None:
    pipeline = TelemetryPipeline(Path(args.output), network=args.network)
    dashboard = await pipeline.stream(
        iterations=args.iterations,
        interval_seconds=args.interval,
        synthetic_population=args.synthetic_users,
    )
    print("Enterprise telemetry dashboard written to", pipeline.dashboard_path)
    print("Latest block:", dashboard.latest_block)
    print("Rolling tx per block:", dashboard.rolling_tx_per_block)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default="telemetry/enterprise", help="Directory for telemetry artifacts")
    parser.add_argument("--network", default="base-sepolia", help="Network to monitor (base-sepolia or zora-sepolia)")
    parser.add_argument("--iterations", type=int, default=3, help="Number of polling iterations to perform")
    parser.add_argument("--interval", type=float, default=2.0, help="Seconds to wait between polls")
    parser.add_argument(
        "--synthetic-users",
        type=int,
        default=25,
        help="Number of synthetic belief-aligned users to sample for session replays",
    )
    args = parser.parse_args()
    asyncio.run(_run(args))


if __name__ == "__main__":
    main()
