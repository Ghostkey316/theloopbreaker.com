from __future__ import annotations

from pathlib import Path
from typing import Any, Mapping, Optional

from ghostops_v1 import (
    GenesisMeshVerifierEngine,
    SignalCloakConfig,
    SignalCloakSystem,
    SoulchainLoyaltyBridge,
)

from mirror_sync import MirrorSync
from vaultfire.core.mirror_engine import MirrorEngine
from vaultfire.core.mirror_state import MirrorState


class QuantumStack:
    """Surface GhostOps v1 capabilities through a single orchestrator."""

    def __init__(
        self,
        cloak_mode: str = "passive",
        keyword_salt: str = "ghostkey-316",
        mesh_store: Path | str = Path("genesismesh_interactions.json"),
        commitments_path: Path | str = Path("soul_commitments.json"),
        reveal_key: Optional[str] = None,
        mirror_secret: Optional[str] = None,
        mirror_token_id: Optional[str] = None,
        ens_identity: str = "ghostkey316.eth",
    ) -> None:
        cloak_config = SignalCloakConfig(mode=cloak_mode, keyword_salt=keyword_salt)
        self.signal_cloak = SignalCloakSystem(cloak_config)
        self.mesh_verifier = GenesisMeshVerifierEngine(mesh_store)
        self.soul_bridge = SoulchainLoyaltyBridge(commitments_path=commitments_path, reveal_key=reveal_key)
        self.mirror_engine = MirrorEngine(ens_identity=ens_identity, token_id=mirror_token_id)
        self.mirror_state = MirrorState(secret=mirror_secret or keyword_salt)
        self.mirror_sync = MirrorSync()

    # ------------------------------------------------------------------
    # Signal cloak orchestration
    # ------------------------------------------------------------------
    def obfuscate_prompt(self, prompt: str) -> Mapping[str, str]:
        return self.signal_cloak.obfuscate(prompt)

    def reveal_prompt(self, payload: Mapping[str, str]) -> str:
        return self.signal_cloak.reveal(payload) if isinstance(payload, Mapping) else str(payload)

    # ------------------------------------------------------------------
    # GenesisMesh routing
    # ------------------------------------------------------------------
    def record_interaction(self, session_id: str, endpoint: str, payload: Mapping[str, Any]) -> Any:
        return self.mesh_verifier.record_interaction(session_id, endpoint, payload)

    def export_interactions(self, output_path: Path | str) -> Path:
        return self.mesh_verifier.export_receipts(output_path)

    # ------------------------------------------------------------------
    # Soulchain loyalty
    # ------------------------------------------------------------------
    def register_action(
        self,
        action_id: str,
        behavior_score: float,
        proof_streak: float,
        ethos_score: float,
        networks: Optional[list[str]] = None,
    ) -> Mapping[str, Any]:
        return self.soul_bridge.record_action(action_id, behavior_score, proof_streak, ethos_score, networks)

    def reveal_commitments(self, reveal_key: Optional[str] = None):
        return self.soul_bridge.reveal_commitments(reveal_key=reveal_key)

    # ------------------------------------------------------------------
    # Sovereign mirror layer
    # ------------------------------------------------------------------
    def mirror_finalize(
        self,
        session_id: str,
        prompt: str,
        response: str,
        alignment_score: Optional[float] = None,
    ) -> Mapping[str, Any]:
        record = self.mirror_engine.record_interaction(
            session_id=session_id,
            prompt=prompt,
            response=response,
            token_id=self.mirror_engine.token_id,
        )
        state_entry = self.mirror_state.log_prompt(
            session_id=session_id,
            prompt=prompt,
            response=response,
            alignment_score=alignment_score,
            annotations={"mirror_score": record.mirror_score},
        )
        token_id = record.token_id or "unbound"
        metadata = self.mirror_sync.compose_metadata(
            token_id=token_id,
            ens_identity=record.ens_identity,
            last_entry=state_entry,
            mirror_record=record,
        )
        sync_receipt = self.mirror_sync.sync_metadata(token_id, metadata)
        return {
            "record": record.to_payload(),
            "state": {
                "state_hash": state_entry.state_hash,
                "receipt": state_entry.receipt,
                "timestamp": state_entry.timestamp,
                "alignment_score": state_entry.alignment_score,
            },
            "sync": sync_receipt,
        }


__all__ = ["QuantumStack"]
