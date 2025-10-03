"""FastAPI surface for the live pilot testnet."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .config import LiveTestConfig, load_config
from .pipeline import LiveTestPipeline
from .telemetry import TelemetryManager, telemetry_manager


class ActivationRequest(BaseModel):
    pilot_signal_hash: str = Field(..., description="Synthetic pilot signal hash")
    wallet_id: str = Field(..., description="Synthetic wallet identifier")


class AttestationRequest(BaseModel):
    metrics: Dict[str, Any]


class LiveTelemetryState(BaseModel):
    event_totals: Dict[str, int]
    recent_traces: list[str]
    last_exported_at: str
    ci_cd_audit_hook: str


def get_pipeline(request: Request) -> LiveTestPipeline:
    pipeline = getattr(request.app.state, "live_pipeline", None)
    if pipeline is None:
        raise HTTPException(status_code=500, detail="Live pipeline not initialised")
    return pipeline


def create_app(*, config: LiveTestConfig | None = None, telemetry: TelemetryManager | None = None) -> FastAPI:
    cfg = config or load_config()
    telemetry_ref = telemetry or telemetry_manager
    telemetry_ref.configure_interval(cfg.telemetry_interval_seconds)

    app = FastAPI(
        title="Vaultfire Live Pilot",
        description="Sandboxed live testnet with telemetry-backed activation flows.",
        version="0.1.0",
        contact={"name": "Vaultfire Compliance Sandbox", "email": "audit@vaultfire.local"},
        openapi_tags=[
            {"name": "activation", "description": "Activation to yield flows"},
            {"name": "attestation", "description": "Telemetry-backed attestations"},
            {"name": "telemetry", "description": "Live telemetry and dashboards"},
        ],
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.state.telemetry = telemetry_ref
    app.state.config = cfg
    app.state.audit_metadata = cfg.audit_metadata
    app.state.live_pipeline = None

    @app.middleware("http")
    async def trace_requests(request: Request, call_next):
        start = datetime.utcnow().isoformat() + "Z"
        trace_id = telemetry_ref.record_event(
            "http_request",
            {
                "path": request.url.path,
                "method": request.method,
                "start": start,
                "client": request.client.host if request.client else "unknown",
            },
        )
        request.state.trace_id = trace_id
        response = await call_next(request)
        telemetry_ref.record_event(
            "http_response",
            {
                "path": request.url.path,
                "method": request.method,
                "status_code": response.status_code,
                "trace_id": trace_id,
            },
        )
        response.headers["X-Live-Test-Trace"] = trace_id
        response.headers["X-Audit-Hook"] = cfg.audit_metadata.get("hook", "unset")
        return response

    @app.on_event("startup")
    async def startup_event() -> None:
        if not cfg.live_test_flag:
            raise RuntimeError("Configuration live_test_flag must be enabled for live pilot")
        telemetry_ref.start_background_exporter(interval_seconds=cfg.telemetry_interval_seconds)
        telemetry_ref.record_event(
            "startup",
            {
                "system": cfg.system_name,
                "live_test_flag": cfg.live_test_flag,
                "audit_provider": cfg.audit_metadata.get("provider"),
            },
        )
        telemetry_ref.export_summary()
        app.state.live_pipeline = LiveTestPipeline(config=cfg, telemetry=telemetry_ref)

    @app.on_event("shutdown")
    async def shutdown_event() -> None:
        telemetry_ref.record_event("shutdown", {"system": cfg.system_name})
        telemetry_ref.shutdown()

    @app.get("/health", tags=["telemetry"])
    async def health_check() -> Dict[str, Any]:
        return {
            "status": "ok",
            "system": cfg.system_name,
            "live_test_flag": cfg.live_test_flag,
            "audit": cfg.audit_metadata,
        }

    @app.get("/synthetic-wallets", tags=["activation"])
    async def synthetic_wallets(pipeline: LiveTestPipeline = Depends(get_pipeline)) -> list[Dict[str, Any]]:
        return [wallet.__dict__ for wallet in pipeline.registry.list_wallets()]

    @app.post("/activation-to-yield", tags=["activation"])
    async def activation_endpoint(payload: ActivationRequest, pipeline: LiveTestPipeline = Depends(get_pipeline)) -> Dict[str, Any]:
        try:
            result = pipeline.process_activation(
                pilot_signal_hash=payload.pilot_signal_hash,
                wallet_id=payload.wallet_id,
            )
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        telemetry_ref.record_event("activation_request", {"trace_id": result["trace_id"], "wallet_id": payload.wallet_id})
        return result

    @app.post("/attest", tags=["attestation"])
    async def attest_endpoint(payload: AttestationRequest, pipeline: LiveTestPipeline = Depends(get_pipeline)) -> Dict[str, Any]:
        attested = pipeline.attest_metrics(payload.metrics)
        telemetry_ref.record_event("attestation_request", {"trace_id": attested["trace_id"]})
        return attested

    @app.get("/telemetry", response_model=LiveTelemetryState, tags=["telemetry"])
    async def telemetry_snapshot() -> LiveTelemetryState:
        summary = telemetry_ref.export_summary()
        return LiveTelemetryState(**summary)

    return app


__all__ = ["create_app"]
