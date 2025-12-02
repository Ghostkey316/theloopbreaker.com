"""CLI interface for recalling synced Vaultfire loop memory snapshots."""

from __future__ import annotations

import argparse
import base64
import hashlib
import hmac
import json
from pathlib import Path
from typing import Mapping, Sequence

from vaultfire.memory.modules.vault_memory_sync import VaultMemorySync


class LoopMemoryCLI:
    """Recall loop memory snapshots with filter helpers."""

    def __init__(self, *, memory_sync: VaultMemorySync | None = None) -> None:
        self.memory_sync = memory_sync or VaultMemorySync()

    def recall(
        self,
        soulprint: str | None = None,
        *,
        epoch: str | None = None,
        pop_tier: str | None = None,
        amplifier_boost: float | None = None,
        validator_id: str | None = None,
    ) -> Sequence[Mapping[str, object]]:
        return self.memory_sync.recall(
            soulprint,
            epoch=epoch,
            pop_tier=pop_tier,
            amplifier_boost=amplifier_boost,
            validator_id=validator_id,
        )

    def latest(self, soulprint: str) -> Mapping[str, object] | None:
        snapshots = self.recall(soulprint)
        return snapshots[-1] if snapshots else None


def sign_vaultloop(snapshot_path: str | Path, *, private_key: str | Path, signature_path: str | Path | None = None) -> Path:
    """Sign a .vaultloop snapshot with an HMAC digest."""

    snapshot = Path(snapshot_path)
    key_path = Path(private_key)
    signature_path = Path(signature_path) if signature_path else snapshot.with_suffix(".vaultproof.sig")

    payload = snapshot.read_bytes()
    key = key_path.read_bytes()
    digest = hashlib.sha256(payload).digest()
    signature = hmac.new(key, digest, hashlib.sha256).digest()

    payload = {
        "format": ".vaultproof.sig",
        "algorithm": "HMAC-SHA256",
        "digest": base64.b64encode(digest).decode(),
        "signature": base64.b64encode(signature).decode(),
        "snapshot": snapshot.name,
    }

    signature_path.write_text(json.dumps(payload, indent=2))
    return signature_path


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Recall and optionally sign Vaultfire .vaultloop snapshots")
    parser.add_argument("snapshot", help="Path to a .vaultloop snapshot file")
    parser.add_argument("--sign", action="store_true", help="Sign the provided snapshot")
    parser.add_argument("--private-key", dest="private_key", help="Path to the private key used for signing")
    parser.add_argument("--signature-path", dest="signature_path", help="Optional signature output path")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(args=argv)

    snapshot_path = Path(args.snapshot)
    if not snapshot_path.exists():
        parser.error(f"snapshot not found: {snapshot_path}")

    if args.sign:
        if not args.private_key:
            parser.error("--sign requires --private-key to be provided")
        signature_path = sign_vaultloop(snapshot_path, private_key=args.private_key, signature_path=args.signature_path)
        print(json.dumps({"status": "signed", "signature": str(signature_path)}))
        return 0

    # If not signing, print the snapshot contents for inspection
    try:
        data = json.loads(snapshot_path.read_text())
    except json.JSONDecodeError:
        parser.error("snapshot is not valid JSON")
    print(json.dumps(data, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


__all__ = ["LoopMemoryCLI", "sign_vaultloop", "main"]
