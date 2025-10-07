"""Embedded self-checks for Vaultfire protocol utilities."""
from __future__ import annotations

from .core import TrialModeActivationError, activate_trial_mode
from .identity import IdentityManager
from .utils import guardian_attestation, trace_logger

__all__ = ["test_normalization", "test_validation"]


def _run_activation():
    identity = IdentityManager.load("ghostkey316.eth")
    return activate_trial_mode(
        identity=identity,
        enable_telemetry=True,
        enable_signal=True,
        enable_governance=True,
        trace_hooks=[trace_logger.capture_all(), guardian_attestation.observe()],
    )


def test_normalization() -> bool:
    """Return ``True`` when activation payloads normalize correctly."""

    activation = _run_activation()
    telemetry = activation["config"]["telemetry_sinks"]
    trackers = activation["config"]["signal_trackers"]
    return telemetry == ["trace_logger"] and trackers == ["trace_logger", "guardian_attestation"]


def test_validation() -> bool:
    """Return ``True`` when invalid identities trigger validation errors."""

    try:
        activate_trial_mode(
            identity=" ",
            wallet_id="trial.wallet",
            trial_codename="Golden Trial",
            config={
                "telemetry_sinks": ["primary"],
                "signal_trackers": ["LoopScanner"],
                "yield_engine": {
                    "enable_retro_mode": True,
                    "rewards_enabled": True,
                    "epoch_streaming": True,
                    "multiplier_sim": "golden_trial",
                },
                "mesh_layer": {
                    "detect_ghostkey": True,
                    "enable_hidden_paths": True,
                    "prophecy_trigger": True,
                },
                "governance_scrutiny": "observer_review",
                "traffic_simulation": "Manual Observer",
                "auth_by": "Ghostkey Architect",
            },
        )
    except TrialModeActivationError:
        return True
    return False
