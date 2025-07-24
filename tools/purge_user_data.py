"""Utility to purge local user data across Vaultfire logs."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

BASE_DIR = Path(__file__).resolve().parents[1]

FILES: dict[Path, str] = {
    BASE_DIR / "user_scorecard.json": "dict",
    BASE_DIR / "user_goals.json": "dict",
    BASE_DIR / "user_list.json": "list",
    BASE_DIR / "ghostscores.json": "dict",
    BASE_DIR / "logs" / "alignment_feedback.json": "entries",
    BASE_DIR / "immutable_log.jsonl": "jsonl",
}


def _load_json(path: Path, default: Any) -> Any:
    if path.exists():
        try:
            with open(path) as f:
                return json.load(f)
        except json.JSONDecodeError:
            return default
    return default


def _write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def purge_user(user_id: str, wallet: str | None = None) -> None:
    """Remove ``user_id`` and optional ``wallet`` from local logs."""
    for path, kind in FILES.items():
        if not path.exists():
            continue
        if kind == "dict":
            data = _load_json(path, {})
            if user_id in data:
                del data[user_id]
                _write_json(path, data)
        elif kind == "list":
            data = _load_json(path, [])
            new_data = [x for x in data if x != user_id]
            if data != new_data:
                _write_json(path, new_data)
        elif kind == "entries":
            data = _load_json(path, [])
            new_data = [e for e in data if e.get("user_id") != user_id and (wallet is None or e.get("wallet") != wallet)]
            if data != new_data:
                _write_json(path, new_data)
        elif kind == "jsonl":
            lines = path.read_text().splitlines()
            new_lines = [line for line in lines if user_id not in line and (wallet is None or wallet not in line)]
            if lines != new_lines:
                path.write_text("\n".join(new_lines) + ("\n" if new_lines else ""))


def _cli() -> None:
    parser = argparse.ArgumentParser(description="Purge local data for a user")
    parser.add_argument("user_id", help="User identifier to remove")
    parser.add_argument("--wallet", help="Wallet or ENS to match", default=None)
    args = parser.parse_args()
    purge_user(args.user_id, args.wallet)
    print(f"Purged data for {args.user_id}")


if __name__ == "__main__":
    _cli()
