"""Temporal Gift Matrix engine for belief-weighted airdrops."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Iterable, List, Mapping, MutableMapping, Sequence

from vaultfire.protocol.signal_echo import SignalEchoEngine
from vaultfire.protocol.timeflare import TimeFlare

from .pulsesync import PulseSync
from vaultfire.quantum.hashmirror import QuantumHashMirror


@dataclass(frozen=True)
class GiftAllocation:
    """Immutable representation of a matrix allocation."""

    wallet: str
    interaction_id: str
    allocation: float
    belief_score: float
    signal_weight: float
    timeline_branch: str
    priority: str
    identity_tag: str
    alignment_bias: float
    ethic_score: float


@dataclass
class GiftMatrixRecord:
    """Ledger artifact capturing a full matrix run."""

    record_id: str
    interaction_id: str
    created_at: datetime
    allocations: Sequence[GiftAllocation] = field(default_factory=tuple)
    metadata: Mapping[str, object] = field(default_factory=dict)


class TemporalGiftMatrixEngine:
    """Compute allocation weights using signal echoes and timeline forks."""

    RECORD_ID = "GiftMatrixRecord#0001-GHOSTKEY316"

    BRANCH_MULTIPLIERS = {
        "stable": 1.0,
        "monitor": 0.9,
        "divergent": 0.7,
    }

    PRIORITY_MULTIPLIERS = {
        "low": 1.0,
        "medium": 0.95,
        "critical": 0.85,
    }

    def __init__(
        self,
        *,
        timeflare: TimeFlare,
        signal_engine: SignalEchoEngine,
        pulse_sync: PulseSync | None = None,
        hash_mirror: QuantumHashMirror | None = None,
        base_reward: float = 100.0,
    ) -> None:
        self._timeflare = timeflare
        self._signal_engine = signal_engine
        self._pulse_sync = pulse_sync or PulseSync()
        self._hash_mirror = hash_mirror or QuantumHashMirror()
        self._base_reward = float(base_reward)
        self._records: MutableMapping[str, GiftMatrixRecord] = {}

    # ------------------------------------------------------------------
    # public helpers
    # ------------------------------------------------------------------
    def generate_matrix(
        self,
        interaction_id: str,
        recipients: Iterable[str | Mapping[str, object]],
    ) -> GiftMatrixRecord:
        """Compute allocations for ``recipients``."""

        recipients = list(recipients)
        frames = self._signal_engine.frames(interaction_id)
        signal_weight = self._signal_engine.signal_weight(interaction_id)
        belief_score = self._pulse_sync.score(frames)
        fork = self._latest_fork(interaction_id)

        branch = fork.get("branch", "stable")
        priority = fork.get("priority", "low")
        ethic_score = float(fork.get("ethic_score", 0.5))
        alignment_bias = float(fork.get("alignment_bias", 0.0))

        allocations: List[GiftAllocation] = []
        for item in recipients:
            profile = self._normalize_recipient(item)
            wallet = profile["wallet"]
            belief_multiplier = profile["belief_multiplier"]
            trajectory_bonus = profile["trajectory_bonus"]

            adjusted_belief = max(min(belief_score * belief_multiplier, 1.0), -1.0)
            composite = self._composite_score(
                belief=adjusted_belief,
                signal_weight=signal_weight,
                ethic_score=ethic_score,
                alignment_bias=alignment_bias + trajectory_bonus,
            )
            amount = self._resolve_amount(composite, branch, priority)
            tag_payload = {
                "composite": composite,
                "belief": adjusted_belief,
                "signal_weight": signal_weight,
                "ethic_score": ethic_score,
            }
            identity_tag = self._hash_mirror.imprint(
                wallet,
                interaction_id=interaction_id,
                branch=branch,
                payload=tag_payload,
            )
            allocations.append(
                GiftAllocation(
                    wallet=wallet,
                    interaction_id=interaction_id,
                    allocation=amount,
                    belief_score=adjusted_belief,
                    signal_weight=signal_weight,
                    timeline_branch=branch,
                    priority=priority,
                    identity_tag=identity_tag,
                    alignment_bias=alignment_bias + trajectory_bonus,
                    ethic_score=ethic_score,
                )
            )

        record = GiftMatrixRecord(
            record_id=self.RECORD_ID,
            interaction_id=interaction_id,
            created_at=datetime.now(timezone.utc),
            allocations=tuple(allocations),
            metadata={
                "belief_score": belief_score,
                "signal_weight": signal_weight,
                "timeline_branch": branch,
                "priority": priority,
            },
        )
        self._records[interaction_id] = record
        return record

    def record(self, interaction_id: str) -> GiftMatrixRecord | None:
        """Return the cached record for ``interaction_id``."""

        return self._records.get(interaction_id)

    # ------------------------------------------------------------------
    # internal helpers
    # ------------------------------------------------------------------
    def _normalize_recipient(self, item: str | Mapping[str, object]) -> Mapping[str, float | str]:
        if isinstance(item, str):
            return {
                "wallet": item,
                "belief_multiplier": 1.0,
                "trajectory_bonus": 0.0,
            }
        wallet = str(item.get("wallet"))
        belief_multiplier = float(item.get("belief_multiplier", 1.0))
        trajectory_bonus = float(item.get("trajectory_bonus", 0.0))
        return {
            "wallet": wallet,
            "belief_multiplier": belief_multiplier,
            "trajectory_bonus": trajectory_bonus,
        }

    def _latest_fork(self, interaction_id: str) -> Mapping[str, object]:
        entries = [entry for entry in self._timeflare.load() if entry.get("interaction_id") == interaction_id]
        if not entries:
            return {}
        entries.sort(key=lambda item: item.get("created_at", ""))
        return entries[-1]

    def _composite_score(
        self,
        *,
        belief: float,
        signal_weight: float,
        ethic_score: float,
        alignment_bias: float,
    ) -> float:
        components = 0.0
        components += max(belief, 0.0) * 0.45
        components += max(signal_weight, 0.0) * 0.3
        components += max(ethic_score, 0.0) * 0.2
        components += max(alignment_bias, 0.0) * 0.05
        return max(min(components, 1.0), 0.0)

    def _resolve_amount(self, composite: float, branch: str, priority: str) -> float:
        branch_multiplier = self.BRANCH_MULTIPLIERS.get(branch, 0.8)
        priority_multiplier = self.PRIORITY_MULTIPLIERS.get(priority, 0.9)
        base = self._base_reward * (0.5 + (composite * 0.5))
        return round(base * branch_multiplier * priority_multiplier, 6)


__all__ = [
    "GiftAllocation",
    "GiftMatrixRecord",
    "TemporalGiftMatrixEngine",
]

