"""Conscious State Engine used by the Vaultfire protocol stack."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Iterable, Mapping, MutableSequence, Sequence

from ._metadata import build_metadata

IDENTITY_HANDLE = "bpow20.cb.id"
IDENTITY_ENS = "ghostkey316.eth"


def _now_ts() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class LedgerAction:
    """Immutable record storing a conscious state action."""

    payload: Mapping[str, object]
    approved: bool
    belief_delta: float
    recorded_at: str = field(default_factory=_now_ts)

    def to_payload(self) -> Mapping[str, object]:
        return {
            "payload": dict(self.payload),
            "approved": self.approved,
            "belief_delta": self.belief_delta,
            "recorded_at": self.recorded_at,
        }


class ConsciousStateEngine:
    """Record ethics-checked ledger actions and compute belief health."""

    POSITIVE_ETHICS = {"aligned", "support", "sacrifice", "uplift"}
    NEGATIVE_ETHICS = {"betrayal", "selfish", "drain"}

    def __init__(
        self,
        *,
        identity_handle: str = IDENTITY_HANDLE,
        identity_ens: str = IDENTITY_ENS,
    ) -> None:
        self.identity_handle = identity_handle
        self.identity_ens = identity_ens
        self._ledger: MutableSequence[LedgerAction] = []
        self.metadata: Mapping[str, object] = build_metadata(
            "ConsciousStateEngine",
            identity={
                "wallet": identity_handle,
                "ens": identity_ens,
            },
        )

    # ------------------------------------------------------------------
    # action tracking
    # ------------------------------------------------------------------
    def record_action(self, action: Mapping[str, object]) -> LedgerAction:
        """Store an ethics filtered ledger action."""

        ethic = str(action.get("ethic", "aligned")).lower()
        weight = float(action.get("weight", 1.0))
        belief_delta = self._resolve_belief_delta(ethic, weight)
        if "approved" in action:
            approved = bool(action.get("approved"))
        else:
            approved = ethic in self.POSITIVE_ETHICS
        payload = dict(action)
        payload.setdefault(
            "identity",
            {"wallet": self.identity_handle, "ens": self.identity_ens},
        )
        payload.setdefault("ethic", ethic)
        record = LedgerAction(payload=payload, approved=approved, belief_delta=belief_delta)
        self._ledger.append(record)
        return record

    def extend_actions(self, actions: Iterable[Mapping[str, object]]) -> None:
        """Bulk load actions, resilient to malformed entries."""

        for entry in actions:
            if isinstance(entry, Mapping):
                self.record_action(entry)

    def _resolve_belief_delta(self, ethic: str, weight: float) -> float:
        if ethic in self.POSITIVE_ETHICS:
            return min(1.0, 0.5 + abs(weight) * 0.1)
        if ethic in self.NEGATIVE_ETHICS:
            return max(-1.0, -0.5 - abs(weight) * 0.1)
        return 0.0

    # ------------------------------------------------------------------
    # analytics
    # ------------------------------------------------------------------
    def belief_health(self) -> float:
        """Return the average belief delta constrained to ``[0, 1]``."""

        if not self._ledger:
            return 1.0
        raw = sum(entry.belief_delta for entry in self._ledger) / len(self._ledger)
        return max(0.0, min((raw + 1.0) / 2.0, 1.0))

    def sync_diagnostics(self) -> Mapping[str, object]:
        """Expose Ghostkey CLI friendly diagnostics."""

        last = self._ledger[-1] if self._ledger else None
        return {
            "identity": self.metadata["identity"],
            "actions": len(self._ledger),
            "belief_health": self.belief_health(),
            "last_action": dict(last.payload) if last else None,
            "metadata": self.metadata,
        }

    def ledger(self) -> Sequence[LedgerAction]:
        """Return a snapshot of the ledger."""

        return tuple(self._ledger)


__all__ = ["ConsciousStateEngine", "LedgerAction"]

