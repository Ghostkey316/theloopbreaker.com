#!/usr/bin/env python3
"""Run the enterprise load simulation against the API surface."""

import argparse
import asyncio
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

from integration.load_environment import EnterpriseIntegrationEnvironment, LoadSimulationConfig


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--concurrent-users", type=int, default=10_000)
    parser.add_argument("--duration", type=int, default=180)
    parser.add_argument("--ramp", type=int, default=60)
    return parser.parse_args()


async def _run(args: argparse.Namespace) -> None:
    config = LoadSimulationConfig(
        concurrent_users=args.concurrent_users,
        duration_seconds=args.duration,
        ramp_up_seconds=args.ramp,
    )
    environment = EnterpriseIntegrationEnvironment(config)
    summary = await environment.simulate()
    print("Load test summary:")
    for key, value in summary.items():
        print(f" - {key}: {value}")


def main() -> None:
    args = parse_args()
    asyncio.run(_run(args))


if __name__ == "__main__":
    main()
