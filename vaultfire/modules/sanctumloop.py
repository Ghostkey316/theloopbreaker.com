"""Recursive sanctum defense loop for Vaultfire.

The :class:`SanctumLoop` helper orchestrates a layered defence that
preserves user lineage while blurring access timestamps and limiting
repeated exposure within and across sessions. It composes existing
``CloakPulse`` and ``SignalScrambler`` primitives so the behaviour remains
compatible with the deployed Vaultfire 2.2 stack.
"""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
import logging
from typing import Dict, List, Mapping, MutableMapping, Sequence

from cloak_pulse import CloakPulse
from signal_scrambler import SignalScrambler


LOGGER = logging.getLogger("vaultfire.SanctumLoop")


def _hash_lineage(user_id: str) -> str:
    digest = hashlib.sha3_256(user_id.encode("utf-8")).hexdigest()
    return f"ghostkey316:{digest[:16]}"


@dataclass
class SanctumRecord:
    """Represents a single sanctum loop entry."""

    user_lineage: str
    session_id: str
    shield_signature: str
    exposure_count: int
    timestamp_mask: str
    route_hint: str


class SanctumLoop:
    """Coordinate the recursive pulse defence loop."""

    def __init__(
        self,
        *,
        cloak_pulse: CloakPulse | None = None,
        signal_scrambler: SignalScrambler | None = None,
        exposure_limit: int = 5,
        wallet_signature: str = "bpow20.cb.id",
        logger: logging.Logger | None = None,
    ) -> None:
        if exposure_limit <= 0:
            raise ValueError("exposure_limit must be positive")
        self._pulse = cloak_pulse or CloakPulse(lineage="SanctumLoop", debug=True)
        self._scrambler = signal_scrambler or SignalScrambler(
            cloak_pulse=self._pulse, wallet_origin=wallet_signature, debug=True
        )
        self._wallet_signature = wallet_signature
        self._exposure_limit = exposure_limit
        self._logger = logger or LOGGER
        self._lineage_cache: Dict[str, str] = {}
        self._session_counts: MutableMapping[str, int] = {}
        self._history: List[SanctumRecord] = []

    def _lineage_for(self, user_id: str) -> str:
        if user_id not in self._lineage_cache:
            self._lineage_cache[user_id] = _hash_lineage(user_id)
        return self._lineage_cache[user_id]

    def _session_key(self, user_lineage: str, session_id: str) -> str:
        return f"{user_lineage}::{session_id}"

    def shield_query(
        self,
        user_id: str,
        session_id: str,
        query_signature: str,
    ) -> Mapping[str, object]:
        """Return a cloaked representation for a query."""

        lineage = self._lineage_for(user_id)
        key = self._session_key(lineage, session_id)
        count = self._session_counts.get(key, 0) + 1
        self._session_counts[key] = count
        if count > self._exposure_limit:
            self._logger.warning(
                "Sanctum exposure limit reached",
                extra={"lineage": lineage, "session": session_id},
            )
            return {
                "user_lineage": lineage,
                "session_id": session_id,
                "status": "rate_limited",
                "exposure_limit": self._exposure_limit,
            }

        pulse = self._pulse.emit(context=query_signature)
        scrambled = self._scrambler.scramble([query_signature], route_hint="sanctum")
        signature = scrambled[0].noise_fingerprint
        timestamp_mask = self._pulse.blend_signatures(
            [pulse.signature, lineage, session_id], context=self._wallet_signature
        )
        record = SanctumRecord(
            user_lineage=lineage,
            session_id=session_id,
            shield_signature=signature,
            exposure_count=count,
            timestamp_mask=timestamp_mask,
            route_hint="sanctum",
        )
        self._history.append(record)
        self._logger.info(
            "Sanctum loop advanced",
            extra={"lineage": lineage, "session": session_id, "count": count},
        )
        return {
            "user_lineage": lineage,
            "session_id": session_id,
            "shield_signature": signature,
            "timestamp_mask": timestamp_mask,
            "exposure_count": count,
            "heartbeat": pulse.heartbeat,
        }

    def status(self) -> Mapping[str, object]:
        """Return a summary of sanctum activity."""

        active_sessions = len(self._session_counts)
        total_records = len(self._history)
        latest_mask = self._history[-1].timestamp_mask if self._history else None
        return {
            "wallet_signature": self._wallet_signature,
            "active_sessions": active_sessions,
            "records": total_records,
            "latest_timestamp_mask": latest_mask,
            "exposure_limit": self._exposure_limit,
        }

    def audit_trail(self) -> Sequence[SanctumRecord]:
        """Return the captured sanctum records."""

        return tuple(self._history)


__all__ = ["SanctumLoop", "SanctumRecord"]

