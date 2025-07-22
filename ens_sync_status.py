# Reference: ethics/core.mdx
"""CLI tool to read sync status for an ENS name."""

import argparse
import json

from engine.ens_sync_status import read_sync_status


def main() -> None:
    parser = argparse.ArgumentParser(description="Check sync status via ENS")
    parser.add_argument("ens", help="ENS name to query")
    args = parser.parse_args()

    status = read_sync_status(args.ens)
    print(json.dumps(status, indent=2))


if __name__ == "__main__":
    main()
