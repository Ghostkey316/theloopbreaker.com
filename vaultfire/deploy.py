"""Deployment helpers for Vaultfire agents."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Literal

logger = logging.getLogger(__name__)

DeploymentMode = Literal["pilot", "staging", "production"]
TelemetryMode = Literal["stealth", "observability", "diagnostic"]


@dataclass(frozen=True)
class DeploymentRequest:
    """Immutable representation of a deployment request."""

    agent_id: str
    env: str
    config_signature: str
    mode: DeploymentMode
    telemetry: TelemetryMode


@dataclass(frozen=True)
class DeploymentResult:
    """Summary returned after a deployment has been triggered."""

    request: DeploymentRequest
    status: Literal["queued", "completed"]


class DeploymentError(RuntimeError):
    """Raised when a deployment cannot be initiated."""


def deploy_agent_bundle(
    *,
    agent_id: str,
    env: str,
    config_signature: str,
    mode: DeploymentMode,
    telemetry: TelemetryMode,
) -> DeploymentResult:
    """Trigger a Vaultfire agent deployment.

    The function performs lightweight validation and logs the deployment
    metadata. In a production system this would hand off to the Vaultfire
    orchestrator. Here we simulate the hand-off and return a structured
    summary that can be asserted in tests.
    """

    if not agent_id:
        raise DeploymentError("Agent identifier is required for deployment")
    if len(config_signature) < 16:
        raise DeploymentError("Configuration signature is invalid or too short")
    if mode not in ("pilot", "staging", "production"):
        raise DeploymentError(f"Unsupported deployment mode: {mode}")
    if telemetry not in ("stealth", "observability", "diagnostic"):
        raise DeploymentError(f"Unsupported telemetry mode: {telemetry}")

    request = DeploymentRequest(
        agent_id=agent_id,
        env=env,
        config_signature=config_signature,
        mode=mode,
        telemetry=telemetry,
    )

    logger.info(
        "Queued deployment for agent %s in %s (%s telemetry)",
        agent_id,
        env,
        telemetry,
    )

    return DeploymentResult(request=request, status="queued")


__all__ = [
    "DeploymentError",
    "DeploymentMode",
    "DeploymentRequest",
    "DeploymentResult",
    "TelemetryMode",
    "deploy_agent_bundle",
]
