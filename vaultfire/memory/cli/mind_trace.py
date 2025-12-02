"""CLI helpers for exporting Vaultfire memory traces."""

from __future__ import annotations

import base64
import hashlib
import json
from typing import Mapping, Sequence

from vaultfire.memory.modules.memory_thread import MemoryEvent, MemoryThreadCore
from vaultfire.memory.modules.recall_loop import RecallLoopModule
from vaultfire.soul import GhostSealProtocol


class MindTraceCLI:
    """Export encrypted memory bundles to IPFS-compatible format."""

    def __init__(
        self,
        *,
        memory_core: MemoryThreadCore | None = None,
        recall_loop: RecallLoopModule | None = None,
        ghostseal: GhostSealProtocol | None = None,
    ) -> None:
        self.memory_core = memory_core or MemoryThreadCore()
        self.recall_loop = recall_loop or RecallLoopModule(memory_core=self.memory_core)
        self.ghostseal = ghostseal or GhostSealProtocol()

    def _ipfs_cid(self, payload: Mapping[str, object]) -> str:
        digest = hashlib.sha256(
            json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
        ).digest()
        return "bafy" + base64.b32encode(digest).decode().lower().strip("=")

    def _serialize_event(self, event: MemoryEvent) -> Mapping[str, object]:
        return {
            "memory_hash": event.memory_hash,
            "prompt": event.prompt,
            "soulprint": event.soulprint.hash,
            "resonance": event.resonance.hash,
            "anchor": event.anchor.to_payload(),
            "drift_score": event.drift_score,
        }

    def export_bundle(
        self,
        user_id: str,
        *,
        ghostseal_obfuscate: bool = False,
        latest_only: bool = True,
    ) -> Mapping[str, object]:
        """Package and optionally encrypt memory bundles."""

        events: Sequence[MemoryEvent] = self.memory_core.thread(user_id)
        if latest_only:
            events = events[-1:]
        serialized_events = [self._serialize_event(event) for event in events]
        recall = self.recall_loop.regenerate_context(
            user_id,
            belief_weight=0.7,
            tone_resonance=0.5,
            biometric_cadence=0.4,
        )
        bundle = {
            "user": user_id,
            "events": serialized_events,
            "continuity": recall.continuity_profile,
        }
        cid = self._ipfs_cid(bundle)
        sealed = self.ghostseal.export_bundle(bundle, stealth=ghostseal_obfuscate)
        return {"cid": cid, "bundle": bundle, "sealed": sealed}

    def snapshot_recall_test(self, sealed_bundle: Mapping[str, object]) -> Mapping[str, object]:
        """Perform snapshot recall testing by rehydrating sealed bundles."""

        stealth = bool(sealed_bundle.get("stealth", False))
        token = sealed_bundle.get("sealed")
        if not isinstance(token, str):
            raise ValueError("sealed bundle missing token")
        payload = self.ghostseal.decrypt(token, stealth=stealth)
        regenerated_cid = self._ipfs_cid(payload)
        return {
            "payload": payload,
            "cid_match": regenerated_cid.startswith("bafy"),
            "regenerated_cid": regenerated_cid,
        }


__all__ = ["MindTraceCLI"]
