# Reference: ethics/core.mdx
"""CLI tool to read sync status for an ENS name."""

import argparse
import json
from datetime import datetime

from engine.ens_sync_status import read_sync_status


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Check sync status via ENS")
    parser.add_argument("ens", help="ENS name to query")
    parser.add_argument(
        "--force-sync",
        action="store_true",
        help="simulate resync even if status is current",
    )
    parser.add_argument(
        "--belief",
        default="None",
        help="alignment belief phrase",
    )
    args = parser.parse_args(argv)

    status = read_sync_status(args.ens)

    if args.force_sync:
        status["resync"] = f"Simulated re-sync triggered for {args.ens}"
        status["resync_timestamp"] = datetime.utcnow().isoformat()

    if args.belief != "None":
        status["belief"] = args.belief

    print(json.dumps(status, indent=2))


if __name__ == "__main__":
    main()
