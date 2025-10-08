"""ShadowFrost deception layer primitives for the Ghostshroud stack."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
import hashlib
import secrets
from typing import Dict, Iterable, List, Optional, Sequence


@dataclass
class AddressMutationRecord:
    """Audit trail for dynamic address mutations."""

    original: str
    mutated: str
    timestamp: datetime
    mobility_vector: str
    seed_fragment: str


@dataclass
class RekeySchedule:
    """Represents a stealth rekeying window for an identity."""

    identity: str
    context: str
    scope: str
    next_rotation: datetime
    entropy_hint: str
    mobile_channel: bool
    wallet_channel: bool


@dataclass
class TimeShiftedTransaction:
    """Container for time-shift cloaked transactions."""

    tx_id: str
    original_timestamp: datetime
    cloaked_timestamp: datetime
    offset_seconds: int


@dataclass
class HandshakeResult:
    """Represents the outcome of the quantum-resistant handshake fallback."""

    peer_fingerprint: str
    negotiated_cipher: str
    fallback_cipher: str
    override_route: str
    status: str


class ShadowFrostDeceptionLayer:
    """Implements ShadowFrost deception surfaces for Ghostshroud."""

    def __init__(self, override_identity: str = "Ghostkey-316") -> None:
        self.override_identity = override_identity
        self._mutations: List[AddressMutationRecord] = []
        self._rekey_windows: Dict[str, List[RekeySchedule]] = {}

    @property
    def mutation_log(self) -> Sequence[AddressMutationRecord]:
        """Read-only view of the mutation log."""

        return tuple(self._mutations)

    def mutate_address(
        self,
        current_address: str,
        mobility_vector: str,
        seed: Optional[str] = None,
    ) -> str:
        """Return a deterministic yet obfuscated address using the mobility vector."""

        if not current_address.startswith("0x"):
            raise ValueError("current_address must be a hex-prefixed string")

        salt = seed or secrets.token_hex(16)
        digest = hashlib.sha3_256(
            f"{current_address}:{mobility_vector}:{salt}".encode("utf-8")
        ).hexdigest()
        mutated = f"0x{digest[:40]}"
        record = AddressMutationRecord(
            original=current_address,
            mutated=mutated,
            timestamp=datetime.utcnow(),
            mobility_vector=mobility_vector,
            seed_fragment=salt[:8],
        )
        self._mutations.append(record)
        return mutated

    def schedule_rekey(
        self,
        identity: str,
        context: str,
        *,
        scope: str = "wallet",
        lead_time: timedelta = timedelta(minutes=11),
        mobile_channel: bool = True,
        wallet_channel: bool = True,
    ) -> RekeySchedule:
        """Plan a stealth rekeying event for the provided identity."""

        entropy = secrets.token_hex(12)
        schedule = RekeySchedule(
            identity=identity,
            context=context,
            scope=scope,
            next_rotation=datetime.utcnow() + lead_time,
            entropy_hint=entropy[:10],
            mobile_channel=mobile_channel,
            wallet_channel=wallet_channel,
        )
        self._rekey_windows.setdefault(identity, []).append(schedule)
        return schedule

    def cloak_transactions(
        self,
        transactions: Iterable[dict],
        *,
        max_window: timedelta = timedelta(minutes=5),
    ) -> List[TimeShiftedTransaction]:
        """Apply deterministic time shifts to transactions to avoid pattern leakage."""

        tx_list = list(transactions)
        if not tx_list:
            return []

        window_seconds = int(max_window.total_seconds())
        interval = max(1, window_seconds // (len(tx_list) + 1))
        cloaked: List[TimeShiftedTransaction] = []
        base_time = datetime.utcnow()
        for index, tx in enumerate(tx_list, start=1):
            original_ts = tx.get("timestamp", base_time)
            if not isinstance(original_ts, datetime):
                raise TypeError("transaction timestamp must be a datetime instance")
            offset = interval * index
            cloaked_ts = original_ts + timedelta(seconds=offset)
            cloaked.append(
                TimeShiftedTransaction(
                    tx_id=str(tx.get("id", index)),
                    original_timestamp=original_ts,
                    cloaked_timestamp=cloaked_ts,
                    offset_seconds=offset,
                )
            )
        return cloaked

    def negotiate_quantum_fallback(self, peer_fingerprint: str) -> HandshakeResult:
        """Negotiate a quantum-resistant handshake fallback route."""

        digest = hashlib.sha3_512(peer_fingerprint.encode("utf-8")).hexdigest()
        negotiated = "Vaultfire-Lattice-X25519"
        fallback = "Kyber1024" if int(digest[:8], 16) % 2 else "Falcon-1024"
        route = f"ghostkey316://override/{self.override_identity}/{digest[:12]}"
        status = "override-ready" if self.override_identity == "Ghostkey-316" else "degraded"
        return HandshakeResult(
            peer_fingerprint=peer_fingerprint,
            negotiated_cipher=negotiated,
            fallback_cipher=fallback,
            override_route=route,
            status=status,
        )

    def pending_rekeys(self, identity: Optional[str] = None) -> List[RekeySchedule]:
        """Return outstanding rekey windows for an identity or the entire pool."""

        if identity is None:
            schedules = [schedule for values in self._rekey_windows.values() for schedule in values]
        else:
            schedules = list(self._rekey_windows.get(identity, []))
        return sorted(schedules, key=lambda item: item.next_rotation)
