"""Offline hook for partner activation simulation."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

from simulate_partner_activation import simulate_activation, ALIGNMENT_PHRASE


def _load_input(path: str) -> dict[str, Any]:
    try:
        if path == "-":
            return json.load(sys.stdin)
        return json.load(Path(path).open())
    except (FileNotFoundError, json.JSONDecodeError) as exc:
        raise ValueError(f"invalid input: {exc}") from exc


def main(argv: list[str] | None = None) -> int:
    argv = argv or sys.argv[1:]
    if not argv:
        print("Usage: activation_hook.py <input_json or ->")
        return 1

    try:
        data = _load_input(argv[0])
    except ValueError as exc:
        print(exc)
        return 1
    partner_id = data.get("partner_id")
    wallets = data.get("wallets", [])
    phrase = data.get("phrase", ALIGNMENT_PHRASE)

    result = simulate_activation(partner_id, wallets, phrase)
    json.dump(result, sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0 if result["success"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
