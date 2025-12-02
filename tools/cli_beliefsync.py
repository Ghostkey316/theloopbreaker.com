"""CLI utility for manually syncing vaultloop snapshots to NS3."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from vaultfire.beliefsync import BeliefSync
from utils.belief_signer import BeliefSigner


DEFAULT_CACHE = Path("status/beliefsync_last.json")
DEFAULT_SNAPSHOT = Path("status/latest.vaultloop")
DEFAULT_ENDPOINT = "https://ns3.local/sync/beliefs"


def _load_snapshot(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text())
    if not isinstance(data, dict):
        raise ValueError("snapshot file must contain a JSON object")
    return data


def _store_payload(payload: dict[str, Any], cache: Path) -> None:
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(payload, indent=2, sort_keys=True))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["sync", "last", "validate"], help="action to run")
    parser.add_argument("--secret", required=False, help="HMAC secret used for signing")
    parser.add_argument("--window", type=int, default=60, help="rotation window in seconds")
    parser.add_argument(
        "--endpoint",
        default=DEFAULT_ENDPOINT,
        help="NS3 endpoint used for sync dispatch",
    )
    parser.add_argument(
        "--snapshot",
        type=Path,
        default=DEFAULT_SNAPSHOT,
        help="Path to vaultloop snapshot for sync",
    )
    parser.add_argument(
        "--cache",
        type=Path,
        default=DEFAULT_CACHE,
        help="Path for persisting last synced payload",
    )
    parser.add_argument(
        "--receipt",
        type=Path,
        default=None,
        help="Receipt file to validate when using the validate command",
    )
    return parser


def _build_syncer(secret: str | None, window: int, endpoint: str) -> BeliefSync:
    if not secret:
        raise ValueError("--secret is required for signing")
    signer = BeliefSigner(secret, window_seconds=window)
    return BeliefSync(signer, ns3_endpoint=endpoint)


def main(args: list[str] | None = None) -> int:
    parser = build_parser()
    options = parser.parse_args(args=args)

    if options.command == "last":
        cache = options.cache
        if not cache.exists():
            print("No payload cached yet")
            return 0
        print(cache.read_text())
        return 0

    syncer = _build_syncer(options.secret, options.window, options.endpoint)

    if options.command == "sync":
        snapshot = _load_snapshot(options.snapshot)
        payload = syncer.sync_from_vaultloop(snapshot)
        result = syncer.push_to_ns3(payload)
        _store_payload(dict(payload), options.cache)
        print(json.dumps({"payload": payload, "response": result.response}, indent=2, sort_keys=True))
        return 0

    if options.command == "validate":
        if options.receipt is None:
            raise ValueError("--receipt is required for validate command")
        receipt_data = json.loads(options.receipt.read_text())
        valid = syncer.validate_receipt(receipt_data)
        print("receipt valid" if valid else "receipt invalid")
        return 0

    raise ValueError(f"unsupported command: {options.command}")


if __name__ == "__main__":  # pragma: no cover - CLI entry point
    raise SystemExit(main())
