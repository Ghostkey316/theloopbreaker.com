"""Utility for generating Vaultfire attestation packs."""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
from typing import Any, Mapping, MutableMapping, Sequence
from uuid import uuid4

from codex_checker import CodexChecker

_REPO_ROOT = Path(__file__).resolve().parents[1]
_DEFAULT_OUTPUT = _REPO_ROOT / "vaultfire_attestation_pack.json"


@dataclass(frozen=True)
class ArtifactDigest:
    name: str
    path: Path
    sha256: str

    def export(self) -> Mapping[str, Any]:
        return {"name": self.name, "path": str(self.path), "sha256": self.sha256}


def _hash_bytes(data: bytes) -> str:
    return sha256(data).hexdigest()


def _hash_file(path: Path) -> ArtifactDigest:
    digest = _hash_bytes(path.read_bytes())
    return ArtifactDigest(name=path.stem, path=path, sha256=digest)


def _load_codex_validation() -> Mapping[str, Any]:
    report = CodexChecker().run()
    payload = report.as_dict()
    payload["hash"] = _hash_bytes(json.dumps(payload, sort_keys=True).encode("utf-8"))
    return payload


def generate_pack(*, signer: str, label: str | None = None) -> Mapping[str, Any]:
    artifacts: Sequence[ArtifactDigest] = [
        _hash_file(_REPO_ROOT / "vaultfire" / "trust" / "fhe_proof.json"),
        _hash_file(_REPO_ROOT / "vaultfire" / "trust" / "zk_codex_receipts.json"),
    ]
    validation = _load_codex_validation()
    body: MutableMapping[str, Any] = {
        "pack_id": uuid4().hex,
        "label": label or "vaultfire-public-pilot",
        "signer": signer,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "artifacts": [artifact.export() for artifact in artifacts],
        "codex_validation": validation,
    }
    checksum = _hash_bytes(json.dumps(body, sort_keys=True).encode("utf-8"))
    signature = _hash_bytes(f"{signer}:{checksum}".encode("utf-8"))
    return {"pack": body, "checksum": checksum, "signature": {"signer": signer, "digest": signature}}


def write_pack(payload: Mapping[str, Any], destination: Path) -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
    return destination


def generate_and_write_pack(*, signer: str, destination: Path, label: str | None = None) -> Mapping[str, Any]:
    pack = generate_pack(signer=signer, label=label)
    write_pack(pack, destination)
    return pack


def _parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate Vaultfire attestation pack")
    parser.add_argument("--sign", required=True, help="Signer identifier for the pack")
    parser.add_argument("--output", default=str(_DEFAULT_OUTPUT), help="Output path or label")
    parser.add_argument("--label", help="Optional label override")
    return parser.parse_args(argv)


def resolve_destination(spec: str) -> Path:
    path = Path(spec)
    if path.suffix:
        return path
    if spec == "pack":
        return _DEFAULT_OUTPUT
    return _REPO_ROOT / "attestation" / f"{spec}_attestation_pack.json"


def main(argv: Sequence[str] | None = None) -> int:
    args = _parse_args(argv)
    destination = resolve_destination(args.output)
    pack = generate_and_write_pack(signer=args.sign, destination=destination, label=args.label)
    print(json.dumps({"output": str(destination), "pack_id": pack["pack"]["pack_id"]}, indent=2))
    return 0


if __name__ == "__main__":  # pragma: no cover - CLI entrypoint
    raise SystemExit(main())


__all__ = [
    "ArtifactDigest",
    "generate_pack",
    "generate_and_write_pack",
    "resolve_destination",
    "write_pack",
]
