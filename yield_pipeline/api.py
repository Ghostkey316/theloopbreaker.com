"""FastAPI application exposing yield insights and mission proofs."""

from __future__ import annotations

import json
import os
from collections import deque
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
from statistics import mean
from typing import Any, Deque, Dict, List, Optional, Tuple

from fastapi import Depends, FastAPI, HTTPException, Request

from .config import settings
from .converter import case_studies_to_yield_insights, convert_pilot_logs, load_case_studies
from .audit_storage import (
    AuditStorage,
    CLOUD_ENVIRONMENT,
    LOCAL_ENVIRONMENT,
)

try:  # pragma: no cover - optional dependency path
    from web3 import Web3  # type: ignore
except ModuleNotFoundError:  # pragma: no cover - fallback when web3 missing
    Web3 = None  # type: ignore

RequestLog = Deque[datetime]
_rate_log: Dict[str, RequestLog] = {}
_repo_root = Path(__file__).resolve().parents[1]
_case_study_index = _repo_root / "knowledge_repo" / "data" / "case_studies.json"
_oracle_contract: Optional[Any] = None
_oracle_provider: Optional[Any] = None


def _hash_ip(value: str) -> str:
    return sha256(value.encode("utf-8")).hexdigest()


def _resolve_environment(path: Path) -> AuditStorage:
    resolved = Path(path)
    environment = CLOUD_ENVIRONMENT if str(resolved).startswith("/var") else LOCAL_ENVIRONMENT
    return AuditStorage(resolved, environment=environment)


def _audit_store() -> AuditStorage:
    return _resolve_environment(settings.attestations_path)


def rate_limiter(request: Request) -> None:
    ip = request.client.host if request.client else "unknown"
    now = datetime.now(timezone.utc)
    log = _rate_log.setdefault(ip, deque())
    while log and (now - log[0]).total_seconds() > 60:
        log.popleft()
    if len(log) >= settings.rate_limit_per_minute:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    log.append(now)


def _decode_signature(raw: str) -> bytes:
    if raw.startswith("0x"):
        raw = raw[2:]
    try:
        return bytes.fromhex(raw)
    except ValueError as exc:  # pragma: no cover - path guarded via HTTP 400
        raise HTTPException(status_code=400, detail="Invalid zkSig encoding") from exc


def _ensure_oracle_contract() -> Optional[Any]:
    global _oracle_contract, _oracle_provider
    if Web3 is None:
        return None
    if _oracle_contract is not None:
        return _oracle_contract

    address = os.getenv("BELIEF_ORACLE_ADDRESS")
    if not address:
        return None

    rpc_url = os.getenv("BASE_RPC_URL", "https://mainnet.base.org")
    provider = Web3(Web3.HTTPProvider(rpc_url, request_kwargs={"timeout": 10}))
    if not provider.is_connected():
        return None

    abi = [
        {
            "inputs": [
                {"internalType": "string", "name": "vow", "type": "string"},
                {"internalType": "address", "name": "seeker", "type": "address"},
            ],
            "name": "previewResonance",
            "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
            "stateMutability": "view",
            "type": "function",
        }
    ]

    try:
        contract = provider.eth.contract(address=Web3.to_checksum_address(address), abi=abi)
    except ValueError:
        return None

    _oracle_contract = contract
    _oracle_provider = provider
    return contract


def _derive_seeker(signature: bytes) -> str:
    if Web3 is None:
        digest = sha256(signature).digest()
        return "0x" + digest[-20:].hex()
    digest = Web3.keccak(signature)
    return Web3.to_checksum_address(digest[-20:].hex())


def _compute_resonance(vow: str, signature: bytes) -> Tuple[int, str, bool]:
    contract = _ensure_oracle_contract()
    seeker = _derive_seeker(signature)
    score: Optional[int]

    if contract is not None and _oracle_provider is not None:
        try:
            score = contract.functions.previewResonance(vow, seeker).call()
        except Exception:  # pragma: no cover - network issues fall back to deterministic scoring
            score = None
    else:
        score = None

    if score is None:
        digest = sha256((vow + signature.hex()).encode("utf-8")).digest()
        score = int.from_bytes(digest, "big") % 101

    proof_material = sha256(signature + vow.encode("utf-8")).hexdigest()
    vest = score > 80
    return score, proof_material, vest


def authenticate(request: Request) -> None:
    if settings.api_key:
        provided = request.headers.get("X-API-Key")
        if provided != settings.api_key:
            raise HTTPException(status_code=401, detail="Invalid API key")


def _ensure_timezone(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def parse_date_range(date_range: Optional[str]) -> Tuple[Optional[datetime], Optional[datetime]]:
    if not date_range:
        return None, None
    try:
        start_raw, end_raw = [part.strip() for part in date_range.split(",", 1)]
        start = _ensure_timezone(datetime.fromisoformat(start_raw))
        end = _ensure_timezone(datetime.fromisoformat(end_raw))
        return start, end
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid date_range format") from exc


def filter_case_studies(
    studies: List[dict],
    segment_id: Optional[str],
    date_range: Tuple[Optional[datetime], Optional[datetime]],
) -> List[dict]:
    start, end = date_range
    filtered = []
    for study in studies:
        if segment_id and segment_id != study["belief_segment"]:
            continue
        timestamp = _ensure_timezone(datetime.fromisoformat(study["timestamp"]))
        if start and timestamp < start:
            continue
        if end and timestamp > end:
            continue
        filtered.append(study)
    return filtered


def _load_case_study_record(case_id: str = "ghostkey_316") -> Optional[dict]:
    if not _case_study_index.exists():
        return None
    try:
        data = json.loads(_case_study_index.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None
    for entry in data:
        if entry.get("id") == case_id:
            return entry
    return None


@asynccontextmanager
async def _lifespan(_: FastAPI):
    convert_pilot_logs()
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="Vaultfire Yield Insights",
        version="1.0.0",
        description="Ethical, scalable and transparent yield case studies pipeline.",
        lifespan=_lifespan,
    )

    @app.get("/api/yield-insights", dependencies=[Depends(rate_limiter), Depends(authenticate)])
    async def get_yield_insights(
        request: Request,
        segment_id: Optional[str] = None,
        date_range: Optional[str] = None,
    ) -> List[dict]:
        convert_pilot_logs()
        case_studies = load_case_studies()
        insights = case_studies_to_yield_insights(case_studies)
        filtered = filter_case_studies(insights, segment_id, parse_date_range(date_range))
        audit_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "client_hash": _hash_ip(request.client.host if request.client else "unknown"),
            "segment": segment_id,
            "results": len(filtered),
        }
        _audit_store().append(audit_entry)
        return filtered

    @app.get("/api/proof/v1/ghostkey-316")
    async def get_ghostkey_proof() -> dict:
        convert_pilot_logs()
        studies = load_case_studies()
        average_roi = mean(study.ghostscore_roi for study in studies) if studies else 0.0
        mission_hashes = sorted({study.mission_hash for study in studies})
        metadata = _load_case_study_record() or {}
        audit_descriptor = _audit_store().as_descriptor()
        audit_descriptor["environments"] = [
            {
                "name": env.name,
                "vaultfire_env": env.vaultfire_env,
                "beta_compatible": env.beta_compatible,
            }
            for env in (LOCAL_ENVIRONMENT, CLOUD_ENVIRONMENT)
        ]

        response = {
            "ghostkey_case": "first externally-visible proof point",
            "partner_ready": True,
            "mission_hashes": mission_hashes,
            "activation_to_yield": {
                "total_cases": len(studies),
                "average_ghostscore_delta": round(average_roi, 2),
            },
            "case_study": metadata,
            "reward_interface": {
                "stream_ready": True,
                "on_chain_ready": False,
                "rpc_integration": {
                    "beta_compatible": True,
                    "flag": "rpc_placeholder",
                },
            },
            "audit_storage": audit_descriptor,
        }
        return response

    @app.get("/belief-oracle", dependencies=[Depends(rate_limiter), Depends(authenticate)])
    async def belief_oracle_endpoint(vow: str, zkSig: str) -> dict:
        signature = _decode_signature(zkSig)
        score, proof, vest = _compute_resonance(vow, signature)
        _audit_store().append(
            {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "vow_hash": sha256(vow.encode("utf-8")).hexdigest(),
                "score": score,
                "yield_vest": vest,
            }
        )
        return {"score": float(score), "proof": proof, "yieldVest": vest}

    return app


app = create_app()
