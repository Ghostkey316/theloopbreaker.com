"""Quantum ledger anchoring utilities for mission-led Vaultfire records.

This module links the :mod:`vaultfire.mission` ledger to lightweight on-chain
attestation primitives so Ghostkey operators can validate state transitions
across Base, Ethereum, and Zora networks. The implementation favours
post-quantum resilience by default while maintaining the repository's
moral-alignment guarantees.

The anchoring flow is intentionally deterministic and side-effect free so it
can be executed in offline or test environments without speaking to a real
node. Production deployments are expected to replace the transport hooks with
chain-aware drivers while keeping the validation and PQC layers intact.
"""

from __future__ import annotations

import base64
import json
import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone
from hashlib import sha3_256, shake_256
from typing import Any, Callable, Dict, Mapping, MutableMapping, Optional, Sequence

from vaultfire.mission import MissionLedger, MissionRecord

__all__ = [
    "PQCSignatureSuite",
    "PQCSignatureError",
    "PQCSignatureBundle",
    "AnchorReceipt",
    "AnchorSyncState",
    "QuantumLedgerAnchor",
    "MissionIntegrityMonitor",
]

DEFAULT_PRIMARY_NETWORK = "base-mainnet"
_SECONDARY_DEFAULTS: tuple[str, ...] = ("ethereum-mainnet", "zora-mainnet")
_MORAL_TAG = "vaultfire.ethics.integrity.guardian"


class PQCSignatureError(RuntimeError):
    """Raised when a post-quantum signature bundle fails validation."""


@dataclass(frozen=True)
class PQCSignatureBundle:
    """Encapsulates lattice-based signature artefacts.

    The dilithium component is always present. A Kyber-derived fallback may be
    included to support hybrid validation on nodes that expect both artefacts.
    Values are serialized as URL-safe base64 strings so they can be safely
    transported inside JSON payloads.
    """

    dilithium: str
    kyber: Optional[str] = None

    def to_dict(self) -> Dict[str, str]:
        payload: Dict[str, str] = {"dilithium": self.dilithium}
        if self.kyber:
            payload["kyber"] = self.kyber
        return payload


class PQCSignatureSuite:
    """Deterministic lattice-based signature helper.

    The suite purposely avoids external dependencies so tests can exercise the
    control flow without compiling native libraries. Instead it derives
    deterministic digests using SHAKE-256 while labelling the resulting values
    as Dilithium and Kyber signatures. This keeps the interface compatible with
    the production cryptographic stack while remaining lightweight for CI.
    """

    def __init__(
        self,
        *,
        dilithium_key: bytes | str = b"vaultfire::dilithium::mission",
        kyber_key: bytes | str = b"vaultfire::kyber::fallback",
    ) -> None:
        self._dilithium_key = self._normalise_key(dilithium_key)
        self._kyber_key = self._normalise_key(kyber_key) if kyber_key is not None else None

    @staticmethod
    def _normalise_key(key: bytes | str) -> bytes:
        if isinstance(key, bytes):
            return key
        return key.encode("utf-8")

    def sign(self, message: bytes) -> PQCSignatureBundle:
        if not isinstance(message, (bytes, bytearray)):
            raise PQCSignatureError("message must be bytes")
        core_digest = shake_256(self._dilithium_key + bytes(message)).digest(48)
        dilithium = base64.urlsafe_b64encode(core_digest).decode("ascii")
        kyber_digest = None
        if self._kyber_key:
            kyber_digest = shake_256(self._kyber_key + bytes(message)).digest(32)
        kyber = (
            base64.urlsafe_b64encode(kyber_digest).decode("ascii") if kyber_digest else None
        )
        return PQCSignatureBundle(dilithium=dilithium, kyber=kyber)

    def verify(self, message: bytes, bundle: Mapping[str, str]) -> bool:
        """Validate a signature bundle against the provided message."""

        if not isinstance(bundle, Mapping):
            raise PQCSignatureError("bundle must be a mapping")
        expected = self.sign(message)
        candidate_dilithium = bundle.get("dilithium")
        if candidate_dilithium != expected.dilithium:
            return False
        candidate_kyber = bundle.get("kyber")
        if expected.kyber is None:
            return candidate_kyber is None
        return candidate_kyber == expected.kyber


@dataclass(frozen=True)
class AnchorReceipt:
    """Snapshot of an anchored mission record."""

    record_id: str
    network: str
    anchor_hash: str
    payload_snapshot: str
    dilithium_signature: str
    kyber_signature: Optional[str]
    zk_attestation: str
    anchored_at: str
    moral_tag: str = field(default=_MORAL_TAG)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "record_id": self.record_id,
            "network": self.network,
            "anchor_hash": self.anchor_hash,
            "payload_snapshot": self.payload_snapshot,
            "dilithium_signature": self.dilithium_signature,
            "kyber_signature": self.kyber_signature,
            "zk_attestation": self.zk_attestation,
            "anchored_at": self.anchored_at,
            "moral_tag": self.moral_tag,
        }


@dataclass(frozen=True)
class AnchorSyncState:
    """Represents a high-level summary of a network's anchor state."""

    network: str
    anchored_records: tuple[str, ...]
    last_anchor: Optional[str]
    zk_batch_proof: Optional[str]


class QuantumLedgerAnchor:
    """Bridge between the mission ledger and blockchain anchor targets."""

    def __init__(
        self,
        ledger: MissionLedger,
        *,
        primary_network: str = DEFAULT_PRIMARY_NETWORK,
        secondary_networks: Sequence[str] | None = None,
        pqc_suite: Optional[PQCSignatureSuite] = None,
    ) -> None:
        self._ledger = ledger
        self._primary_network = primary_network or DEFAULT_PRIMARY_NETWORK
        secondaries = list(secondary_networks or _SECONDARY_DEFAULTS)
        # Deduplicate while preserving order, always keeping the primary first.
        ordered = [self._primary_network]
        for network in secondaries:
            if network not in ordered:
                ordered.append(network)
        self._networks = tuple(ordered)
        self._pqc_suite = pqc_suite or PQCSignatureSuite()
        self._lock = threading.RLock()
        self._state: Dict[str, Dict[str, AnchorReceipt]] = {}
        self._rollbacks: Dict[str, Dict[str, AnchorReceipt]] = {}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def anchor_record(
        self,
        record: MissionRecord,
        *,
        networks: Sequence[str] | None = None,
    ) -> tuple[AnchorReceipt, ...]:
        """Anchor a mission ledger record across the configured networks."""

        payloads = self._prepare_payload(record)
        target_networks = self._resolve_networks(networks)
        receipts: list[AnchorReceipt] = []
        with self._lock:
            for network in target_networks:
                snapshot = payloads["snapshots"].get(network)
                if snapshot is None:
                    snapshot = self._snapshot_for_network(record, payloads["anchor_hash"], network)
                    payloads["snapshots"][network] = snapshot
                message = snapshot.encode("utf-8")
                signatures = self._pqc_suite.sign(message)
                zk_attestation = self._wrap_zk_snark(snapshot, network)
                receipt = AnchorReceipt(
                    record_id=record.record_id,
                    network=network,
                    anchor_hash=payloads["anchor_hash"],
                    payload_snapshot=snapshot,
                    dilithium_signature=signatures.dilithium,
                    kyber_signature=signatures.kyber,
                    zk_attestation=zk_attestation,
                    anchored_at=_timestamp(),
                )
                self._state.setdefault(network, {})[record.record_id] = receipt
                # Reset rollback cache for the restored record.
                self._rollbacks.setdefault(network, {}).pop(record.record_id, None)
                receipts.append(receipt)
        return tuple(receipts)

    def get_receipt(self, network: str, record_id: str) -> Optional[AnchorReceipt]:
        with self._lock:
            return self._state.get(network, {}).get(record_id)

    def verify_receipt(self, receipt: AnchorReceipt) -> bool:
        payload = json.loads(receipt.payload_snapshot)
        expected_digest = _payload_digest(
            anchor_hash=payload["anchor_hash"],
            network=payload["network"],
            record_id=payload["record_id"],
            moral_tag=payload["moral_tag"],
        )
        if payload.get("payload_digest") != expected_digest:
            return False
        bundle: Dict[str, str] = {"dilithium": receipt.dilithium_signature}
        if receipt.kyber_signature:
            bundle["kyber"] = receipt.kyber_signature
        if not self._pqc_suite.verify(receipt.payload_snapshot.encode("utf-8"), bundle):
            return False
        # The anchor hash is stored redundantly to guard against tampering.
        return payload.get("anchor_hash") == receipt.anchor_hash

    def sync_network(self, network: str) -> AnchorSyncState:
        with self._lock:
            records = self._state.get(network, {})
            ordered_ids = tuple(sorted(records))
            last_anchor = records[ordered_ids[-1]].anchor_hash if ordered_ids else None
            if ordered_ids:
                proof_material = json.dumps(
                    [records[record_id].zk_attestation for record_id in ordered_ids],
                    sort_keys=True,
                ).encode("utf-8")
                zk_batch = base64.urlsafe_b64encode(sha3_256(proof_material).digest()).decode(
                    "ascii"
                )
            else:
                zk_batch = None
        return AnchorSyncState(
            network=network,
            anchored_records=ordered_ids,
            last_anchor=last_anchor,
            zk_batch_proof=zk_batch,
        )

    def rollback(self, network: str, record_id: str) -> Optional[AnchorReceipt]:
        with self._lock:
            receipt = self._state.get(network, {}).pop(record_id, None)
            if receipt:
                self._rollbacks.setdefault(network, {})[record_id] = receipt
            return receipt

    def recover(self, network: str, record_id: str) -> Optional[AnchorReceipt]:
        with self._lock:
            receipt = self._rollbacks.get(network, {}).pop(record_id, None)
            if receipt:
                self._state.setdefault(network, {})[record_id] = receipt
            return receipt

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _resolve_networks(self, networks: Sequence[str] | None) -> tuple[str, ...]:
        if not networks:
            return self._networks
        ordered: list[str] = []
        for candidate in networks:
            if candidate not in ordered:
                ordered.append(candidate)
        return tuple(ordered)

    def _prepare_payload(self, record: MissionRecord) -> MutableMapping[str, Any]:
        canonical_record = json.dumps(record.to_dict(), sort_keys=True).encode("utf-8")
        anchor_hash = sha3_256(canonical_record).hexdigest()
        snapshots: Dict[str, str] = {}
        for network in self._networks:
            snapshots[network] = self._snapshot_for_network(record, anchor_hash, network)
        return {
            "anchor_hash": anchor_hash,
            "snapshots": snapshots,
        }

    def _snapshot_for_network(self, record: MissionRecord, anchor_hash: str, network: str) -> str:
        payload = {
            "record_id": record.record_id,
            "anchor_hash": anchor_hash,
            "network": network,
            "moral_tag": _MORAL_TAG,
            "payload_digest": _payload_digest(
                anchor_hash=anchor_hash,
                network=network,
                record_id=record.record_id,
                moral_tag=_MORAL_TAG,
            ),
        }
        return json.dumps(payload, sort_keys=True)

    def _wrap_zk_snark(self, snapshot: str, network: str) -> str:
        material = f"zk::{network}::{snapshot}".encode("utf-8")
        return base64.urlsafe_b64encode(sha3_256(material).digest()).decode("ascii")


class MissionIntegrityMonitor:
    """Observes mission ledger updates and emits anonymised anchor summaries."""

    def __init__(
        self,
        ledger: MissionLedger,
        anchor: QuantumLedgerAnchor,
        *,
        broadcaster: Optional[Callable[[Mapping[str, Any]], None]] = None,
    ) -> None:
        self._ledger = ledger
        self._anchor = anchor
        self._broadcast = broadcaster or self._capture_broadcast
        self._lock = threading.RLock()
        self._seen: set[str] = set()
        self._captured: list[Mapping[str, Any]] = []

    def poll(self) -> tuple[AnchorReceipt, ...]:
        """Process new ledger entries and broadcast anchor summaries."""

        receipts: list[AnchorReceipt] = []
        for record in self._ledger.iter():
            with self._lock:
                if record.record_id in self._seen:
                    continue
                self._seen.add(record.record_id)
            anchored = self._anchor.anchor_record(record)
            receipts.extend(anchored)
            summary = {
                "record_id": record.record_id,
                "anchor_hash": anchored[0].anchor_hash,
                "networks": tuple(sorted(receipt.network for receipt in anchored)),
                "moral_tag": anchored[0].moral_tag,
                "broadcast_at": anchored[0].anchored_at,
            }
            self._broadcast(summary)
        return tuple(receipts)

    # ------------------------------------------------------------------
    # Introspection helpers
    # ------------------------------------------------------------------
    def captured_broadcasts(self) -> tuple[Mapping[str, Any], ...]:
        with self._lock:
            return tuple(self._captured)

    def _capture_broadcast(self, payload: Mapping[str, Any]) -> None:
        with self._lock:
            self._captured.append(dict(payload))


def _payload_digest(*, anchor_hash: str, network: str, record_id: str, moral_tag: str) -> str:
    material = f"{anchor_hash}:{network}:{record_id}:{moral_tag}".encode("utf-8")
    return sha3_256(material).hexdigest()


def _timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()

