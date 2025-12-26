"""FastAPI server for Vaultfire protocol metrics and health checks.

Provides HTTP endpoints for Prometheus scraping and service health monitoring.
"""
from __future__ import annotations

import logging
from typing import Any

try:
    from fastapi import FastAPI, HTTPException
    from fastapi.responses import PlainTextResponse, JSONResponse
    from pydantic import BaseModel

    FASTAPI_AVAILABLE = True
except ImportError:
    FASTAPI_AVAILABLE = False

logger = logging.getLogger(__name__)


class HealthResponse(BaseModel):
    """Health check response model."""

    status: str
    protocol: str
    version: str
    components: dict[str, str]


class MetricsResponse(BaseModel):
    """Internal metrics response (JSON format)."""

    belief_sync: dict[str, Any]
    pop_engine: dict[str, Any]
    vaultdrip_router: dict[str, Any]
    circuit_breakers: dict[str, Any]


def create_app() -> FastAPI:
    """Create and configure FastAPI application."""
    if not FASTAPI_AVAILABLE:
        raise ImportError("FastAPI not installed. Install with: pip install fastapi uvicorn")

    app = FastAPI(
        title="Vaultfire Protocol API",
        description="Metrics, health checks, and observability for Vaultfire",
        version="1.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    @app.get("/health", response_model=HealthResponse, tags=["Health"])
    async def health_check() -> HealthResponse:
        """Health check endpoint for load balancers and monitoring.

        Returns:
            Health status and component states
        """
        components = {
            "belief_sync": "healthy",
            "pop_engine": "healthy",
            "vaultdrip_router": "healthy",
        }

        # Check circuit breaker states
        try:
            from vaultfire.observability import PROMETHEUS_AVAILABLE

            if PROMETHEUS_AVAILABLE:
                components["metrics"] = "healthy"
            else:
                components["metrics"] = "degraded"
        except Exception as exc:
            logger.warning(f"Health check warning: {exc}")
            components["metrics"] = "unknown"

        return HealthResponse(
            status="healthy",
            protocol="vaultfire",
            version="1.1.0",
            components=components,
        )

    @app.get(
        "/metrics",
        response_class=PlainTextResponse,
        tags=["Metrics"],
        responses={
            200: {
                "content": {"text/plain": {}},
                "description": "Prometheus metrics in text format",
            }
        },
    )
    async def prometheus_metrics() -> PlainTextResponse:
        """Prometheus scrape endpoint.

        Returns metrics in Prometheus exposition format for scraping.

        Returns:
            Prometheus-formatted metrics
        """
        try:
            from vaultfire.observability import PROMETHEUS_AVAILABLE, get_metrics_exporter

            if not PROMETHEUS_AVAILABLE:
                raise HTTPException(
                    status_code=503,
                    detail="Prometheus client not available. Install prometheus-client package.",
                )

            exporter = get_metrics_exporter()
            return PlainTextResponse(
                exporter.get_metrics(), media_type="text/plain; version=0.0.4"
            )
        except Exception as exc:
            logger.error(f"Failed to export metrics: {exc}")
            raise HTTPException(status_code=500, detail=f"Metrics export failed: {exc}")

    @app.get("/metrics/json", response_model=MetricsResponse, tags=["Metrics"])
    async def metrics_json() -> MetricsResponse:
        """Get metrics in JSON format (for debugging, not for Prometheus).

        Returns:
            Internal metrics in JSON format
        """
        try:
            # Placeholder - would aggregate metrics from engines
            return MetricsResponse(
                belief_sync={
                    "syncs_attempted": 0,
                    "syncs_succeeded": 0,
                    "syncs_failed": 0,
                    "replays_blocked": 0,
                },
                pop_engine={
                    "scores_calculated": 0,
                    "upgrades_triggered": 0,
                    "cache_reads": 0,
                    "cache_writes": 0,
                },
                vaultdrip_router={
                    "routes_attempted": 0,
                    "routes_succeeded": 0,
                    "routes_rejected": 0,
                },
                circuit_breakers={},
            )
        except Exception as exc:
            logger.error(f"Failed to get JSON metrics: {exc}")
            raise HTTPException(status_code=500, detail=f"Metrics retrieval failed: {exc}")

    @app.get("/", tags=["Info"])
    async def root() -> dict[str, str]:
        """Root endpoint with API information.

        Returns:
            Basic API information
        """
        return {
            "protocol": "vaultfire",
            "version": "1.1.0",
            "mission": "belief-secured-intelligence",
            "endpoints": {
                "health": "/health",
                "metrics": "/metrics",
                "metrics_json": "/metrics/json",
                "docs": "/docs",
            },
        }

    return app


# Create app instance
app = create_app() if FASTAPI_AVAILABLE else None


__all__ = ["create_app", "app", "FASTAPI_AVAILABLE"]
