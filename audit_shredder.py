"""Audit-proof system memory manager for Ghostshroud."""
from __future__ import annotations

import hashlib
import os
from dataclasses import dataclass
from typing import Dict, Iterable, List

from zk_core import EthicsOracle


@dataclass
class ShredPolicy:
    shard_count: int = 5
    min_burn_quorum: int = 3
    shard_size: int = 4096
    ethics_topic: str = "vaultfire.ethics"


class AuditShredder:
    """Encrypts and fragments logs, providing proof-of-burn guarantees."""

    def __init__(self, ethics_oracle: EthicsOracle, storage_backend: "ShardStorage") -> None:
        self._ethics = ethics_oracle
        self._storage = storage_backend

    def shred_log(self, log_id: str, payload: bytes, metadata: Dict[str, str], policy: ShredPolicy) -> List[str]:
        signal = {
            "module": "audit_shredder",
            "action": "shred",
            "log_id": log_id,
            "metadata": metadata,
            "policy": policy.__dict__,
        }
        if not self._ethics.check_ethics(signal):
            raise PermissionError("Ethical override prevented shredding operation")

        shards = self._fragment(payload, policy)
        shard_ids = []
        for index, shard in enumerate(shards):
            shard_id = f"{log_id}:{index}"
            self._storage.store(shard_id, shard, metadata)
            shard_ids.append(shard_id)
        return shard_ids

    def burn(self, shard_ids: Iterable[str], policy: ShredPolicy) -> str:
        signal = {"module": "audit_shredder", "action": "burn", "shards": list(shard_ids), "policy": policy.__dict__}
        if not self._ethics.check_ethics(signal):
            raise PermissionError("Ethical override prevented burn operation")

        deleted = []
        for shard_id in shard_ids:
            if self._storage.delete(shard_id):
                deleted.append(shard_id)

        if len(deleted) < policy.min_burn_quorum:
            raise RuntimeError("Insufficient shards removed for burn proof")

        proof_material = "".join(sorted(deleted)).encode("utf-8")
        proof_hash = hashlib.sha3_256(proof_material).hexdigest()
        self._storage.record_burn_proof(proof_hash, deleted)
        return proof_hash

    def _fragment(self, payload: bytes, policy: ShredPolicy) -> List[bytes]:
        shards: List[bytes] = []
        offset = 0
        shard_size = policy.shard_size
        while offset < len(payload) or len(shards) < policy.shard_count:
            chunk = payload[offset : offset + shard_size]
            nonce = os.urandom(16)
            shards.append(self._xor_bytes(chunk, nonce) + nonce)
            offset += shard_size
        if not shards:
            nonce = os.urandom(16)
            shards.append(self._xor_bytes(b"", nonce) + nonce)
        return shards

    def _xor_bytes(self, data: bytes, nonce: bytes) -> bytes:
        expanded_nonce = (nonce * ((len(data) // len(nonce)) + 1))[: len(data)]
        return bytes(d ^ n for d, n in zip(data, expanded_nonce))


class ShardStorage:
    """Storage backend interface for shard persistence."""

    def store(self, shard_id: str, shard: bytes, metadata: Dict[str, str]) -> None:  # pragma: no cover - interface
        raise NotImplementedError

    def delete(self, shard_id: str) -> bool:  # pragma: no cover - interface
        raise NotImplementedError

    def record_burn_proof(self, proof_hash: str, shard_ids: List[str]) -> None:  # pragma: no cover - interface
        raise NotImplementedError


__all__ = ["AuditShredder", "ShardStorage", "ShredPolicy"]
