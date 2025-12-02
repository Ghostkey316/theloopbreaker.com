"""CLI utility to verify Vaultproof .vaultloop snapshots."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Sequence

from vaultfire.memory.modules.vaultproof_verifier import VaultproofVerifier


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Verify Vaultproof loop snapshots")
    parser.add_argument("snapshot", help="Path to a .vaultloop snapshot")
    parser.add_argument("--signature", help="Optional .vaultproof.sig path")
    parser.add_argument("--key", help="Shared key used to validate the signature")
    parser.add_argument(
        "--pulse-window",
        type=int,
        default=900,
        help="Allowed seconds between the latest echo and the drip timestamp",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(args=argv)

    snapshot_path = Path(args.snapshot)
    if not snapshot_path.exists():
        parser.error(f"snapshot not found: {snapshot_path}")

    verifier = VaultproofVerifier(pulse_window_seconds=args.pulse_window)
    result = verifier.verify(snapshot_path, signature_path=args.signature, key_path=args.key)

    output = {
        "ok": result.ok,
        "signature_valid": result.signature_valid,
        "reasons": list(result.reasons),
        "metadata": dict(result.metadata),
    }
    print(json.dumps(output, indent=2))
    return 0 if result.ok else 1


if __name__ == "__main__":
    raise SystemExit(main())

