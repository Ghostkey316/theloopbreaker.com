"""Shielded contributor pool primitives."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from hashlib import sha256
import json
from pathlib import Path
from typing import Dict, Iterable, Mapping, MutableMapping

__all__ = [
    "ShieldedPool",
    "PrivatePoolLedger",
    "create_pool",
    "register_contribution",
    "schedule_passive_drop",
]


_LEDGER_PATH = Path(__file__).resolve().parent / "private_ledger.json"

_ROLE_DROPS = {
    "ghostkey": {"weekly": 1.5, "milestone": 10.0},
    "contributor": {"weekly": 0.5, "milestone": 3.5},
    "ally": {"weekly": 0.25, "milestone": 2.0},
}


@dataclass(slots=True)
class ShieldedPool:
    """Representation of a privacy preserving pool."""

    pool_id: str
    role: str
    eligibility_hash: str
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_public_payload(self) -> Mapping[str, str]:
        return {
            "pool_id": self.pool_id,
            "role": self.role,
            "eligibility_hash": self.eligibility_hash,
            "created_at": self.created_at,
        }


@dataclass(slots=True)
class PrivatePoolLedger:
    """Ledger wrapper with ZK checksum validation."""

    pools: MutableMapping[str, Mapping[str, object]]

    @classmethod
    def load(cls) -> "PrivatePoolLedger":
        if not _LEDGER_PATH.exists():
            return cls(pools={})
        data = json.loads(_LEDGER_PATH.read_text(encoding="utf-8"))
        pools = data.get("pools", {}) if isinstance(data, Mapping) else {}
        return cls(pools={pool_id: dict(payload) for pool_id, payload in pools.items()})

    def persist(self) -> None:
        payload = {"pools": self.pools}
        _LEDGER_PATH.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")

    def update_pool(self, pool: ShieldedPool) -> None:
        self.pools[pool.pool_id] = pool.to_public_payload()
        self.persist()

    def append_entry(self, pool_id: str, entry: Mapping[str, object]) -> None:
        record = self.pools.setdefault(pool_id, {"entries": []})
        entries = record.setdefault("entries", [])
        entries.append(dict(entry))
        record["zk_checksum"] = compute_checksum(entries)
        self.persist()


def create_pool(pool_id: str, *, role: str, eligibility_proof: Mapping[str, object]) -> ShieldedPool:
    proof_string = json.dumps(eligibility_proof, sort_keys=True, separators=(",", ":"))
    eligibility_hash = sha256(proof_string.encode("utf-8")).hexdigest()
    pool = ShieldedPool(pool_id=pool_id, role=role, eligibility_hash=eligibility_hash)
    ledger = PrivatePoolLedger.load()
    ledger.update_pool(pool)
    return pool


def register_contribution(
    pool_id: str,
    *,
    amount: float,
    evidence: Mapping[str, object],
    drop_type: str | None = None,
) -> Mapping[str, object]:
    timestamp = datetime.now(timezone.utc).isoformat()
    entry = {
        "amount": float(amount),
        "timestamp": timestamp,
        "drop_type": drop_type or "contribution",
        "evidence_hash": sha256(
            json.dumps(evidence, sort_keys=True, separators=(",", ":")).encode("utf-8")
        ).hexdigest(),
    }
    ledger = PrivatePoolLedger.load()
    ledger.append_entry(pool_id, entry)
    return entry


def schedule_passive_drop(pool_id: str, role: str, *, cadence: str) -> Mapping[str, object]:
    drops = _ROLE_DROPS.get(role.lower(), {})
    amount = float(drops.get(cadence.lower(), 0.0))
    payload = {
        "pool_id": pool_id,
        "role": role,
        "cadence": cadence,
        "scheduled_at": datetime.now(timezone.utc).isoformat(),
        "amount": amount,
    }
    ledger = PrivatePoolLedger.load()
    ledger.append_entry(pool_id, payload)
    return payload


def compute_checksum(entries: Iterable[Mapping[str, object]]) -> str:
    serialised = json.dumps(list(entries), sort_keys=True, separators=(",", ":"))
    return sha256(serialised.encode("utf-8")).hexdigest()


# Ensure ledger exists with empty structure for downstream tooling.
if not _LEDGER_PATH.exists():
    PrivatePoolLedger.load().persist()
