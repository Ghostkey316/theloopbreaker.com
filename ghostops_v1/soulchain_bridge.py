from __future__ import annotations

import base64
import hashlib
import json
import secrets
from pathlib import Path
from typing import Dict, List, Mapping, Optional


class SoulchainLoyaltyBridge:
    """Tracks longitudinal Ghostkey-316 actions using rotating proof seeds."""

    def __init__(self, commitments_path: Path | str = Path("soul_commitments.json"), reveal_key: Optional[str] = None):
        self.commitments_path = Path(commitments_path)
        self.reveal_key = reveal_key
        self.proof_seed = secrets.token_hex(16)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _xor_crypt(self, payload: str, key: str) -> str:
        key_bytes = hashlib.sha256(key.encode()).digest()
        data = payload.encode()
        cipher = bytes([byte ^ key_bytes[index % len(key_bytes)] for index, byte in enumerate(data)])
        return base64.urlsafe_b64encode(cipher).decode()

    def _xor_decrypt(self, payload: str, key: str) -> str:
        key_bytes = hashlib.sha256(key.encode()).digest()
        data = base64.urlsafe_b64decode(payload.encode())
        clear = bytes([byte ^ key_bytes[index % len(key_bytes)] for index, byte in enumerate(data)])
        return clear.decode()

    def _load_commitments(self) -> List[Mapping[str, object]]:
        if not self.commitments_path.exists():
            return []
        try:
            return json.loads(self.commitments_path.read_text())
        except json.JSONDecodeError:
            return []

    def _persist(self, entries: List[Mapping[str, object]]) -> None:
        self.commitments_path.parent.mkdir(parents=True, exist_ok=True)
        self.commitments_path.write_text(json.dumps(entries, indent=2))

    def rotate_proof_seed(self) -> str:
        self.proof_seed = secrets.token_hex(16)
        return self.proof_seed

    # ------------------------------------------------------------------
    # Public surface
    # ------------------------------------------------------------------
    @staticmethod
    def loyalty_multiplier(behavior_score: float, proof_streak: float, ethos_score: float) -> float:
        return float(behavior_score) * float(proof_streak) * float(ethos_score)

    def _commitment_payload(
        self,
        action_id: str,
        behavior_score: float,
        proof_streak: float,
        ethos_score: float,
        networks: Optional[List[str]] = None,
    ) -> Dict[str, object]:
        networks = networks or ["Vaultfire", "NS3", "Zora"]
        multiplier = self.loyalty_multiplier(behavior_score, proof_streak, ethos_score)
        payload = {
            "action_id": action_id,
            "behavior_score": behavior_score,
            "proof_streak": proof_streak,
            "ethos_score": ethos_score,
            "networks": networks,
            "proof_seed": self.proof_seed,
            "loyalty_multiplier": multiplier,
        }
        payload_str = json.dumps(payload, sort_keys=True)
        payload["commitment"] = hashlib.sha3_256((payload_str + self.proof_seed).encode()).hexdigest()
        return payload

    def record_action(
        self,
        action_id: str,
        behavior_score: float,
        proof_streak: float,
        ethos_score: float,
        networks: Optional[List[str]] = None,
    ) -> Dict[str, object]:
        payload = self._commitment_payload(action_id, behavior_score, proof_streak, ethos_score, networks)
        entries = self._load_commitments()
        stored_entry: Dict[str, object]
        if self.reveal_key:
            stored_entry = {
                "encrypted": True,
                "data": self._xor_crypt(json.dumps(payload, sort_keys=True), self.reveal_key),
            }
        else:
            stored_entry = {"encrypted": False, "data": payload}

        entries.append(stored_entry)
        self._persist(entries)
        self.rotate_proof_seed()
        return payload

    def reveal_commitments(self, reveal_key: Optional[str] = None) -> List[Dict[str, object]]:
        key = reveal_key or self.reveal_key
        entries = self._load_commitments()
        revealed: List[Dict[str, object]] = []
        for entry in entries:
            if entry.get("encrypted"):
                if not key:
                    continue
                decoded = self._xor_decrypt(str(entry["data"]), key)
                revealed.append(json.loads(decoded))
            else:
                revealed.append(entry["data"])
        return revealed

    def export_commitments(self) -> Path:
        """Convenience alias to surface the commitments path."""

        return self.commitments_path
