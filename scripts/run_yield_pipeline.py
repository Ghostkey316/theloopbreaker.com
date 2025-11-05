"""Async Vaultfire yield pipeline bridging simulations to Base mainnet mocks."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from dataclasses import asdict, dataclass
from hashlib import sha3_256
from pathlib import Path
from typing import Any, Dict, Iterable, List, Sequence

from fastapi import FastAPI
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[1]

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from yield_pipeline import convert_pilot_logs, settings  # noqa: E402
from zk_core import (  # noqa: E402
    CircuitDefinition,
    CircuitRegistry,
    DeterministicPQSuite,
    Prover,
    ProverConfig,
)


class AllowAllConsentOracle:
    """Consent oracle that validates consent tokens for anonymised batches."""

    def is_action_allowed(self, consent_scope: str, payload_hash: str) -> bool:  # noqa: D401
        return consent_scope == "vaultfire-yield" and bool(payload_hash)


class EthicsPassOracle:
    """Ethics oracle ensuring aligned payloads before proof emission."""

    def check_ethics(self, signal: Dict[str, Any]) -> bool:  # noqa: D401
        return signal.get("wallet_consent", False) and signal.get("drift_detection", True)


@dataclass(slots=True)
class BaseRpcSimulationResult:
    mission_hash: str
    projected_apr: float
    gas_estimate: int
    anonymised_user: str


class BaseRpcStub:
    """Deterministic Base RPC mock wired for async use."""

    def __init__(self, url: str) -> None:
        self.url = url

    async def simulate_bundle(self, missions: Sequence[str]) -> List[BaseRpcSimulationResult]:
        async def _simulate(mission_hash: str) -> BaseRpcSimulationResult:
            digest = int.from_bytes(sha3_256(mission_hash.encode("utf-8")).digest(), "big")
            projected_apr = (digest % 4000) / 100.0
            gas_estimate = 42_000 + (digest % 3_000)
            anonymised_user = f"anon-{mission_hash[:8]}"
            await asyncio.sleep(0)
            return BaseRpcSimulationResult(
                mission_hash=mission_hash,
                projected_apr=round(projected_apr, 2),
                gas_estimate=gas_estimate,
                anonymised_user=anonymised_user,
            )

        tasks = [asyncio.create_task(_simulate(mission)) for mission in missions]
        return await asyncio.gather(*tasks)


class SimulationRequest(BaseModel):
    base_rpc_url: str = Field(..., alias="baseRpcUrl")
    source: Path | None = None
    destination: Path | None = None


class SimulationResponse(BaseModel):
    studies: List[Dict[str, Any]]
    projection: List[Dict[str, Any]]
    zk_proof: Dict[str, Any]

    class Config:
        json_encoders = {Path: lambda value: str(value)}


def _build_prover() -> Prover:
    registry = CircuitRegistry()
    circuit = CircuitDefinition(
        name="vaultfire-yield-anonymizer",
        description="Anonymise Base mainnet projections with Dilithium-style attestations",
        consent_scope="vaultfire-yield",
        ethics_signal={"wallet_consent": True, "drift_detection": True},
        config=ProverConfig(backend="zk-stub", circuit_path=ROOT / "zk" / "yield.circom"),
        metadata={"public_inputs": ["mission_hash"]},
    )
    registry.register(circuit)
    pq_suite = DeterministicPQSuite(secret_key=b"vaultfire-secret", public_key=b"vaultfire-public")
    consent = AllowAllConsentOracle()
    ethics = EthicsPassOracle()
    return Prover(registry, consent, ethics, pq_suite)


async def anonymise_projection(
    prover: Prover,
    projection: Iterable[BaseRpcSimulationResult],
) -> Dict[str, Any]:
    payload = [
        {
            "mission_hash": result.mission_hash,
            "projected_apr": result.projected_apr,
            "gas_estimate": result.gas_estimate,
        }
        for result in projection
    ]
    witness = {"projection": payload, "mission_hash": ":".join(sorted(item["mission_hash"] for item in payload))}
    bundle = await asyncio.to_thread(prover.prove, "vaultfire-yield-anonymizer", witness)
    return {
        "circuit": bundle.circuit.name,
        "proof": bundle.proof.hex(),
        "public_inputs": bundle.public_inputs,
        "commitments": bundle.commitments,
    }


async def pipeline(
    base_rpc_url: str,
    *,
    source: Path | None = None,
    destination: Path | None = None,
) -> SimulationResponse:
    """Run the async yield pipeline end-to-end."""

    source_dir = source or settings.mission_logs_dir
    destination_dir = destination or settings.case_study_dir

    case_studies = await asyncio.to_thread(convert_pilot_logs, source_dir, destination_dir)
    missions = [study.mission_hash for study in case_studies]

    rpc = BaseRpcStub(base_rpc_url)
    projection = await rpc.simulate_bundle(missions)
    prover = _build_prover()
    zk_payload = await anonymise_projection(prover, projection)

    return SimulationResponse(
        studies=[study.model_dump(mode="json") for study in case_studies],
        projection=[asdict(result) for result in projection],
        zk_proof=zk_payload,
    )


app = FastAPI(title="Vaultfire Yield Pipeline", version="2.0.0")


@app.post("/simulate_yield", response_model=SimulationResponse)
async def simulate_yield(request: SimulationRequest) -> SimulationResponse:
    return await pipeline(
        request.base_rpc_url,
        source=request.source,
        destination=request.destination,
    )


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Convert pilot logs and project Base yields")
    parser.add_argument(
        "--source",
        type=Path,
        default=settings.mission_logs_dir,
        help="Directory containing pilot log JSON files",
    )
    parser.add_argument(
        "--destination",
        type=Path,
        default=settings.case_study_dir,
        help="Directory where case study JSON files will be written",
    )
    parser.add_argument(
        "--base-rpc-url",
        type=str,
        default=os.getenv("BASE_RPC_URL", "https://base-mainnet.mock"),
        help="Base mainnet RPC endpoint used for simulation",
    )
    return parser.parse_args()


async def _run_cli() -> None:
    args = _parse_args()
    response = await pipeline(args.base_rpc_url, source=args.source, destination=args.destination)
    try:
        payload = response.model_dump(mode="json")
    except AttributeError:  # pragma: no cover - pydantic v1 fallback
        payload = response.dict()
    print(json.dumps(payload, indent=2, default=str))


def main() -> None:
    asyncio.run(_run_cli())


if __name__ == "__main__":
    main()
