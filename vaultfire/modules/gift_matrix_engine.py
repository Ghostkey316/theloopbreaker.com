"""Gift Matrix orchestration aligned with the Living Memory Ledger."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Mapping, MutableMapping

from vaultfire.modules.ethic_resonant_time_engine import EthicResonantTimeEngine
from vaultfire.modules.living_memory_ledger import LivingMemoryLedger


@dataclass(frozen=True)
class Allocation:
    wallet: str
    allocation: float
    belief_score: float
    signal_weight: float
    identity_tag: str

    def to_payload(self) -> Mapping[str, object]:
        return {
            "wallet": self.wallet,
            "allocation": self.allocation,
            "belief_score": self.belief_score,
            "signal_weight": self.signal_weight,
            "identity_tag": self.identity_tag,
        }


class GiftMatrixEngine:
    """Simplified Gift Matrix with impact/ego gating."""

    def __init__(
        self,
        *,
        time_engine: EthicResonantTimeEngine,
        ledger: LivingMemoryLedger,
        identity_handle: str = "bpow20.cb.id",
        identity_ens: str = "ghostkey316.eth",
    ) -> None:
        self.time_engine = time_engine
        self.ledger = ledger
        self.identity_handle = identity_handle
        self.identity_ens = identity_ens
        self.metadata: Mapping[str, object] = {
            "module": "GiftMatrixEngine",
            "identity": {"wallet": identity_handle, "ens": identity_ens},
            "first_of_its_kind": True,
            "tags": ("FOTK",),
        }
        self._claims: MutableMapping[str, Mapping[str, object]] = {}

    # ------------------------------------------------------------------
    # helpers
    # ------------------------------------------------------------------
    def eligible(self, impact: float, ego: float) -> bool:
        return float(impact) > float(ego)

    def _resolve_recipients(
        self, recipients: Iterable[str | Mapping[str, object]]
    ) -> list[tuple[str, float]]:
        resolved: list[tuple[str, float]] = []
        for entry in recipients:
            if isinstance(entry, Mapping):
                wallet = str(entry.get("wallet"))
                belief = float(entry.get("belief_multiplier", 1.0))
                trajectory = float(entry.get("trajectory_bonus", 0.0))
            else:
                wallet = str(entry)
                belief = 1.0
                trajectory = 0.0
            weight = max(0.0, belief + trajectory)
            resolved.append((wallet, weight or 1.0))
        return resolved

    def _build_allocations(
        self,
        recipients: Iterable[str | Mapping[str, object]],
        *,
        impact: float,
    ) -> list[Allocation]:
        resolved = self._resolve_recipients(recipients)
        if not resolved:
            return []
        total = sum(weight for _, weight in resolved) or 1.0
        base = max(impact, 1.0)
        allocations: list[Allocation] = []
        for index, (wallet, weight) in enumerate(resolved, 1):
            fraction = weight / total
            allocations.append(
                Allocation(
                    wallet=wallet,
                    allocation=round(base * fraction, 6),
                    belief_score=round(weight, 4),
                    signal_weight=round(fraction, 4),
                    identity_tag=f"{wallet}::gift::{index}",
                )
            )
        return allocations

    def preview_allocations(
        self,
        *,
        impact: float,
        ego: float,
        recipients: Iterable[str | Mapping[str, object]],
    ) -> Mapping[str, object]:
        return {
            "eligible": self.eligible(impact, ego),
            "tempo": self.time_engine.current_tempo(),
            "allocations": [
                allocation.to_payload()
                for allocation in self._build_allocations(recipients, impact=impact)
            ],
            "metadata": self.metadata,
        }

    # ------------------------------------------------------------------
    # public API
    # ------------------------------------------------------------------
    def prepare_claim(
        self,
        claim_id: str,
        *,
        impact: float,
        ego: float,
        recipients: Iterable[str | Mapping[str, object]],
    ) -> Mapping[str, object]:
        if not self.eligible(impact, ego):
            raise ValueError("impact must be greater than ego to invoke GiftMatrix")

        delta = float(impact) - float(ego)
        self.time_engine.register_action(
            {
                "type": "support",
                "interaction_id": claim_id,
                "weight": max(delta, 0.1) * 10,
            }
        )

        allocations = [
            allocation.to_payload()
            for allocation in self._build_allocations(recipients, impact=impact)
        ]

        record = self.ledger.record(
            {
                "claim_id": claim_id,
                "allocations": allocations,
            },
            trust=min(1.0, 0.55 + delta * 0.1),
            impact=impact,
            ego=ego,
        )

        payload = {
            "claim_id": claim_id,
            "tempo": self.time_engine.current_tempo(),
            "allocations": allocations,
            "record": record.to_payload(),
            "metadata": self.metadata,
        }
        self._claims[claim_id] = payload
        return payload

    def claim(self, claim_id: str) -> Mapping[str, object] | None:
        cached = self._claims.get(claim_id)
        if cached:
            return cached
        for record in self.ledger.records():
            if record.payload.get("claim_id") == claim_id:
                return {
                    "claim_id": claim_id,
                    "record": record.to_payload(),
                    "tempo": self.time_engine.current_tempo(),
                    "metadata": self.metadata,
                }
        return None

