"""Zero-knowledge receipt helpers for belief executions."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from hashlib import sha256
import json
from pathlib import Path
from typing import Iterable, Mapping, MutableSequence

__all__ = [
    "ZKReceipt",
    "record_belief_receipt",
    "load_receipts",
    "verify_receipt_integrity",
]


_RECEIPTS_PATH = Path(__file__).resolve().parent / "zk_codex_receipts.json"


@dataclass(slots=True, frozen=True)
class ZKReceipt:
    """A public facing belief execution receipt."""

    proof_hash: str
    outcome: str
    timestamp: str

    @classmethod
    def create(cls, proof_material: Mapping[str, object]) -> "ZKReceipt":
        """Create a sanitised receipt from raw belief proof material."""

        proof_string = json.dumps(
            {key: proof_material.get(key) for key in sorted(proof_material)},
            sort_keys=True,
            separators=(",", ":"),
        )
        checksum = sha256(proof_string.encode("utf-8")).hexdigest()
        outcome = str(proof_material.get("outcome", "unknown"))
        timestamp = proof_material.get("timestamp")
        if not timestamp:
            timestamp = datetime.now(timezone.utc).isoformat()
        return cls(proof_hash=checksum, outcome=outcome, timestamp=timestamp)

    def to_public_payload(self) -> Mapping[str, str]:
        """Return a serialisable payload suitable for public ledgers."""

        return {
            "proof_hash": self.proof_hash,
            "outcome": self.outcome,
            "timestamp": self.timestamp,
        }


def _load_state() -> MutableSequence[Mapping[str, str]]:
    if not _RECEIPTS_PATH.exists():
        return []
    raw = json.loads(_RECEIPTS_PATH.read_text(encoding="utf-8"))
    receipts = raw.get("receipts", []) if isinstance(raw, Mapping) else []
    return [
        {
            "proof_hash": str(entry.get("proof_hash", "")),
            "outcome": str(entry.get("outcome", "")),
            "timestamp": str(entry.get("timestamp", "")),
        }
        for entry in receipts
    ]


def _store_state(entries: Iterable[Mapping[str, str]]) -> None:
    payload = {"receipts": list(entries)}
    _RECEIPTS_PATH.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")


def record_belief_receipt(proof_material: Mapping[str, object]) -> ZKReceipt:
    """Persist a belief receipt stripped of behavioural inputs."""

    receipt = ZKReceipt.create(proof_material)
    receipts = _load_state()
    receipts.append(receipt.to_public_payload())
    _store_state(receipts)
    return receipt


def load_receipts() -> MutableSequence[Mapping[str, str]]:
    """Return all stored receipts."""

    return _load_state()


def verify_receipt_integrity(proof_hash: str) -> bool:
    """Return ``True`` when a receipt with ``proof_hash`` exists."""

    return any(entry.get("proof_hash") == proof_hash for entry in _load_state())
