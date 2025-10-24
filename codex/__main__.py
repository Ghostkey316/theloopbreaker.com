"""Command line interface for the ``codex`` toolbox."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Sequence

from .pilot import initialise_sandbox


def _resolve_profile(path: str) -> Path:
    candidate = Path(path)
    if not candidate.exists():
        raise FileNotFoundError(f"profile not found: {path}")
    return candidate


def _handle_pilot_init(args: argparse.Namespace) -> int:
    result = initialise_sandbox(_resolve_profile(args.profile))
    print(json.dumps(result.export(), indent=2, sort_keys=True))
    return 0


def create_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="codex", description="Vaultfire Codex utility commands")
    subparsers = parser.add_subparsers(dest="command", required=True)

    pilot_init = subparsers.add_parser(
        "pilot:init",
        help="Initialise sandbox pilot environment",
    )
    pilot_init.add_argument(
        "--profile",
        required=True,
        help="Path to the sandbox profile (YAML or JSON)",
    )
    pilot_init.set_defaults(func=_handle_pilot_init)

    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = create_parser()
    args = parser.parse_args(argv)
    handler = getattr(args, "func", None)
    if handler is None:
        parser.print_help()
        return 1
    return handler(args)


if __name__ == "__main__":  # pragma: no cover - CLI entrypoint
    raise SystemExit(main())
