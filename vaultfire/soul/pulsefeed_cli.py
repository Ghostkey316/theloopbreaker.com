"""PulseFeed CLI for emitting Soul state updates."""

from __future__ import annotations

from typing import Mapping, MutableMapping, Sequence

from .ghostseal_protocol import GhostSealProtocol
from .soulprint_core import SoulPrint, SoulPrintCore
from .voice_sync import VoiceSyncModule


class PulseFeedCLI:
    """Compose onchain-ready Soul updates and export bundles."""

    def __init__(
        self,
        *,
        soul_core: SoulPrintCore | None = None,
        voice_sync: VoiceSyncModule | None = None,
        ghostseal: GhostSealProtocol | None = None,
        default_stealth: bool = True,
    ) -> None:
        self.soul_core = soul_core or SoulPrintCore()
        self.voice_sync = voice_sync or VoiceSyncModule()
        self.ghostseal = ghostseal
        self.default_stealth = default_stealth
        self._last_soulprint: SoulPrint | None = None

    def emit_update(
        self,
        *,
        prompt_cadence: Sequence[object],
        prompt_history: Sequence[str],
        mirror_echoes: Sequence[str],
        drift_patterns: Mapping[str, object],
        belief_deltas: Mapping[str, object],
        emotional_profile: Mapping[str, float] | None = None,
    ) -> Mapping[str, object]:
        soulprint = self.soul_core.generate(
            prompt_cadence=prompt_cadence,
            mirror_echoes=mirror_echoes,
            drift_patterns=drift_patterns,
            belief_deltas=belief_deltas,
            emotional_profile=emotional_profile,
        )
        voice_snapshot = self.voice_sync.capture(prompt_history)
        diff = {
            "previous": getattr(self._last_soulprint, "hash", None),
            "current": soulprint.hash,
            "changed": (self._last_soulprint is None) or (self._last_soulprint.hash != soulprint.hash),
        }
        growth_stream = {
            "streak_integrity": soulprint.metadata.get("streak_integrity", 0),
            "bonding_score": self.voice_sync.bonding_score(),
            "signature_persistence": soulprint.metadata.get("signature_persistence", 0),
        }
        payload: MutableMapping[str, object] = {
            "targets": ("farcaster", "nft"),
            "onchain_ready": True,
            "soulprint": soulprint.__dict__,
            "voice": voice_snapshot,
            "diff": diff,
            "growth": growth_stream,
        }
        if self.ghostseal:
            payload["export"] = self.ghostseal.export_bundle(
                {"soulprint": soulprint.__dict__, "voice": voice_snapshot, "growth": growth_stream},
                stealth=self.default_stealth,
            )
        self._last_soulprint = soulprint
        return dict(payload)


__all__ = ["PulseFeedCLI"]
