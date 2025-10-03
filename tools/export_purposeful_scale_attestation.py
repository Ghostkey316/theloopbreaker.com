"""Export Purposeful Scale attestation packs for partners."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.append(str(BASE_DIR))

from engine import purposeful_scale  # noqa: E402


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate a Purposeful Scale attestation pack for a guardian",
    )
    parser.add_argument("user_id", help="Guardian ENS or unique identifier")
    parser.add_argument(
        "-o",
        "--output",
        help="Path to write the attestation JSON (defaults to stdout)",
        default="-",
    )
    parser.add_argument(
        "-n",
        "--history",
        type=int,
        default=10,
        help="Number of recent scale decisions to include",
    )
    parser.add_argument(
        "--no-index",
        action="store_true",
        help="Skip embedding the mission recall index snapshot",
    )
    parser.add_argument(
        "--redact-denials",
        action="store_true",
        help="Redact reasons for denied requests in the exported history",
    )
    return parser.parse_args(argv)


def write_output(payload: dict, output_path: str) -> None:
    text = json.dumps(payload, indent=2, sort_keys=True)
    if output_path == "-":
        print(text)
        return
    path = Path(output_path)
    path.write_text(text)
    print(f"attestation written to {path}")


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    pack = purposeful_scale.generate_attestation_pack(
        args.user_id,
        history_limit=args.history,
        include_index=not args.no_index,
        redact_denials=args.redact_denials,
    )
    write_output(pack, args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
