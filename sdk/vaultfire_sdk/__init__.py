"""Vaultfire SDK bridging high-level ERV attestation flows."""

from __future__ import annotations

import hashlib
import json
import random
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from vaultfire.protocol.mission_resonance import *  # type: ignore[F401,F403]
from vaultfire.protocol.mission_resonance import (
    __all__ as _mission_exports,
    MissionResonanceEngine,
)

from services.symbiotic_sentience_interface import SymbioticSentienceInterface
from utils.live_oracle import LiveOracleClient, get_live_oracle


@dataclass(slots=True)
class PilotRun:
    """Lightweight container for pilot simulation responses."""

    wallet: str
    gradient: float
    tx_hash: str
    status: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "wallet": self.wallet,
            "gradient": self.gradient,
            "tx": self.tx_hash,
            "status": self.status,
        }


class SymbioticForge:
    """High-level helper orchestrating ERV attestations and pilot simulations."""

    def __init__(self, wallet: str, live_mode: bool = False) -> None:
        self.wallet = wallet
        self.engine = MissionResonanceEngine()
        self._interface = SymbioticSentienceInterface(self.engine.mission)
        self._interface._engine = self.engine  # type: ignore[attr-defined]
        self._gradient = 0.5
        self.oracle: Optional[LiveOracleClient] = get_live_oracle() if live_mode else None
        if self.oracle is not None:
            self._interface._live_oracle = self.oracle  # type: ignore[attr-defined]

    def _derive_proof(self, intent: Dict[str, Any]) -> str:
        payload = json.dumps(intent, sort_keys=True, default=str)
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    def tune_gradient(self, intent: Dict[str, Any]) -> float:
        """Symbiotically tune the active gradient using the BCI intent payload."""

        tuned = self._interface.co_evolve_moral_gradient(intent, self._gradient)
        self._gradient = tuned
        return tuned

    def forge_neural_covenant(self, tuned: float, intent: Dict[str, Any]) -> str:
        """Forge a neural covenant and propagate oracle emissions when available."""

        proof = str(intent.get("proof") or self._derive_proof(intent))
        return self._interface.forge_neural_covenant(tuned, proof)

    def attest_moral_loop(self, intent: Dict[str, Any]) -> str:
        """Run the intent through gradient tuning and neural covenant forging."""

        tuned = self.tune_gradient(intent)
        return self.forge_neural_covenant(tuned, intent)

    def end_to_end_test(self, pilot_type: str = "loyalty") -> List[Dict[str, Any]]:
        """Generate a compact simulation of ERV resonance telemetry for ``pilot_type``."""

        seed = int(hashlib.sha256(f"{pilot_type}:{self.wallet}".encode("utf-8")).hexdigest()[:8], 16)
        rng = random.Random(seed)
        baseline = self._gradient
        results: List[PilotRun] = []
        try:
            for index in range(3):
                alignment = "align" if rng.random() > 0.25 else "diverge"
                alpha_power = round(0.55 + rng.random() * 0.35, 3)
                intent = {
                    "alpha_power": alpha_power,
                    "theta_intent": alignment,
                    "proof": f"{pilot_type}-{index}-{self.wallet}",
                }
                tx_hash = self.attest_moral_loop(intent)
                status = "attested" if alignment == "align" else "pending"
                results.append(
                    PilotRun(
                        wallet=f"{self.wallet}::{pilot_type}::{index}",
                        gradient=self._gradient,
                        tx_hash=tx_hash,
                        status=status,
                    )
                )
            return [run.to_dict() for run in results]
        finally:
            self._gradient = baseline

    def run_pilot_sim(self, pilot_type: str = "loyalty") -> Dict[str, Any]:
        """Execute an end-to-end pilot simulation and emit oracle telemetry."""

        runs = self.end_to_end_test(pilot_type)
        payload = {"pilot": pilot_type, "runs": runs}
        tx_hash: Optional[str] = None
        if self.oracle is not None:
            digest = hashlib.sha256(json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest()
            emission = self.oracle.emit_event(f"sdk::{pilot_type}", digest, {"runs": len(runs)})
            if isinstance(emission, dict):
                tx_hash = emission.get("tx_hash")
        return {"pilot": pilot_type, "runs": runs, "oracle_tx": tx_hash}


__all__ = ["SymbioticForge", *(_mission_exports or [])]
