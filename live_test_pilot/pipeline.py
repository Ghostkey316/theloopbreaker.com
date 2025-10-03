"""Live test pipeline orchestration using Vaultfire primitives."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict

from activation_to_yield import activationToYield
from engine.attestation_engine import attestation_engine
from engine.belief_multiplier import multiplier_capacity_plan

from .config import LiveTestConfig
from .telemetry import TelemetryManager


@dataclass(slots=True)
class SyntheticWallet:
    wallet_id: str
    ens: str
    label: str


class SyntheticWalletRegistry:
    """In-memory registry for sandbox wallets."""

    def __init__(self, wallets: list[dict[str, Any]]) -> None:
        self._wallets = {
            item["wallet_id"]: SyntheticWallet(
                wallet_id=item["wallet_id"],
                ens=item.get("ens", item["wallet_id"]),
                label=item.get("label", "Synthetic Wallet"),
            )
            for item in wallets
        }

    def list_wallets(self) -> list[SyntheticWallet]:
        return list(self._wallets.values())

    def get(self, wallet_id: str) -> SyntheticWallet:
        if wallet_id not in self._wallets:
            raise KeyError(f"Wallet '{wallet_id}' is not part of the synthetic registry")
        return self._wallets[wallet_id]


class LiveTestPipeline:
    """Bridge activation-to-yield flow into attestation metrics."""

    def __init__(self, config: LiveTestConfig, telemetry: TelemetryManager) -> None:
        self.config = config
        self.telemetry = telemetry
        self.registry = SyntheticWalletRegistry(config.synthetic_wallets)

    def _trace(self, event_type: str, payload: Dict[str, Any]) -> str:
        return self.telemetry.record_event(event_type, payload)

    def process_activation(self, *, pilot_signal_hash: str, wallet_id: str) -> Dict[str, Any]:
        wallet = self.registry.get(wallet_id)
        timestamp = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
        result = activationToYield(pilot_signal_hash, timestamp, wallet.ens)
        trace_id = self._trace(
            "activation_to_yield",
            {
                "wallet_id": wallet.wallet_id,
                "ens": wallet.ens,
                "tier": result["tier"],
                "ghostscore": result["ghostscore"],
                "yield_value": result["yield_value"],
                "pilot_signal_hash": pilot_signal_hash,
            },
        )
        result["trace_id"] = trace_id
        result["wallet_label"] = wallet.label
        return result

    def attest_metrics(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
        attestation = attestation_engine(
            metrics,
            validator_id="vaultfire-live-pilot",
        )
        trace_id = self._trace(
            "attestation",
            {
                "validator_id": attestation.validator_id,
                "issued_at": attestation.issued_at,
                "proof_hash": attestation.proof_hash,
            },
        )
        payload = attestation.as_dict()
        payload["trace_id"] = trace_id
        return payload

    def get_capacity_plan(self) -> Dict[str, Any]:
        plan = multiplier_capacity_plan()
        self._trace("capacity_plan_view", {"tiers": len(plan.get("tiers", []))})
        return plan


__all__ = ["LiveTestPipeline", "SyntheticWalletRegistry", "SyntheticWallet"]
