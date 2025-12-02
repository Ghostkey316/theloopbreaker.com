"""CLI interface for recalling synced Vaultfire loop memory snapshots."""

from __future__ import annotations

from typing import Mapping, Sequence

from vaultfire.memory.modules.vault_memory_sync import VaultMemorySync


class LoopMemoryCLI:
    """Recall loop memory snapshots with filter helpers."""

    def __init__(self, *, memory_sync: VaultMemorySync | None = None) -> None:
        self.memory_sync = memory_sync or VaultMemorySync()

    def recall(
        self,
        soulprint: str | None = None,
        *,
        epoch: str | None = None,
        pop_tier: str | None = None,
        amplifier_boost: float | None = None,
        validator_id: str | None = None,
    ) -> Sequence[Mapping[str, object]]:
        return self.memory_sync.recall(
            soulprint,
            epoch=epoch,
            pop_tier=pop_tier,
            amplifier_boost=amplifier_boost,
            validator_id=validator_id,
        )

    def latest(self, soulprint: str) -> Mapping[str, object] | None:
        snapshots = self.recall(soulprint)
        return snapshots[-1] if snapshots else None


__all__ = ["LoopMemoryCLI"]
