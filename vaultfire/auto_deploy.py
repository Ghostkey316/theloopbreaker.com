"""Auto deployment Lambda triggered by MCP signals."""

from __future__ import annotations

from typing import Any, Mapping

from vaultfire.config import VAULTFIRE_ENV
from vaultfire.deploy import deploy_agent_bundle
from vaultfire.utils import sign_deployment, validate_integrity

_SIGNAL_KEY = "vaultfire_pilot_sync"


class AutoDeployError(RuntimeError):
    """Raised when an auto deployment signal fails validation."""


def _require_field(payload: Mapping[str, Any], field: str) -> str:
    try:
        value = payload[field]
    except KeyError as exc:  # pragma: no cover - defensive guard
        raise AutoDeployError(f"Signal payload missing required field: {field}") from exc
    if not value:
        raise AutoDeployError(f"Signal payload field '{field}' is empty")
    return str(value)


def auto_deploy_lambda(signal_payload: Mapping[str, Any]) -> None:
    """Handle the incoming MCP signal and trigger a deployment if valid."""

    if signal_payload.get("signal_key") != _SIGNAL_KEY:
        print("⚠️ Unknown signal received. No action taken.")
        return

    print("🟢 Activation signal received from MCP. Preparing deployment...")

    timestamp = _require_field(signal_payload, "timestamp")
    payload_hash = _require_field(signal_payload, "hash")

    if not validate_integrity(payload_hash, timestamp):
        raise AutoDeployError("❌ Signal integrity check failed. Abort.")

    signature = sign_deployment(agent_id="Ghostkey316", env=str(VAULTFIRE_ENV), timestamp=timestamp)

    deploy_agent_bundle(
        agent_id="Ghostkey316",
        env=str(VAULTFIRE_ENV),
        config_signature=signature,
        mode=signal_payload.get("mode", "pilot"),
        telemetry=signal_payload.get("telemetry", "stealth"),
    )

    print("✅ GhostkeyVaultfireAgent deployed successfully in pilot mode.")


__all__ = ["AutoDeployError", "auto_deploy_lambda"]
