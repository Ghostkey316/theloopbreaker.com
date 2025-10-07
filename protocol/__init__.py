"""Utilities for orchestrating protocol activation flows."""
from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from typing import Any, Dict, List, Mapping, MutableMapping, Sequence

__all__ = ["TrialModeActivationError", "activate_trial_mode"]


class TrialModeActivationError(ValueError):
    """Raised when the ForgeTrail trial activation payload is invalid."""


def _validate_non_empty_string(value: Any, field_name: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise TrialModeActivationError(f"{field_name} must be a non-empty string.")
    return value


def _dedupe_preserve_order(values: Sequence[str], field_name: str) -> List[str]:
    if not isinstance(values, Sequence) or isinstance(values, (str, bytes)):
        raise TrialModeActivationError(f"{field_name} must be a sequence of strings.")
    seen = set()
    result: List[str] = []
    for item in values:
        if not isinstance(item, str) or not item.strip():
            raise TrialModeActivationError(f"{field_name} items must be non-empty strings.")
        if item not in seen:
            seen.add(item)
            result.append(item)
    return result


def _require_bool(mapping: Mapping[str, Any], key: str, context: str) -> bool:
    value = mapping.get(key)
    if not isinstance(value, bool):
        raise TrialModeActivationError(f"{context}.{key} must be a boolean.")
    return value


def _require_string(mapping: Mapping[str, Any], key: str, context: str) -> str:
    value = mapping.get(key)
    if not isinstance(value, str) or not value.strip():
        raise TrialModeActivationError(f"{context}.{key} must be a non-empty string.")
    return value


def activate_trial_mode(
    *,
    identity: str,
    wallet_id: str,
    trial_codename: str,
    config: MutableMapping[str, Any],
) -> Dict[str, Any]:
    """Validate and normalize a Ghostfire ForgeTrail trial activation payload.

    Parameters
    ----------
    identity:
        ENS name or other verified identity descriptor for the caller.
    wallet_id:
        External wallet reference that will anchor the rewards preview mode.
    trial_codename:
        Human-friendly codename describing the active trial scenario.
    config:
        Mutable mapping describing telemetry, signal, and governance inputs.

    Returns
    -------
    dict
        Rich activation payload summarising the normalized configuration.
    """

    identity_value = _validate_non_empty_string(identity, "identity")
    wallet_value = _validate_non_empty_string(wallet_id, "wallet_id")
    codename_value = _validate_non_empty_string(trial_codename, "trial_codename")

    config_copy: Dict[str, Any] = deepcopy(dict(config))

    telemetry_sinks = _dedupe_preserve_order(
        config_copy.get("telemetry_sinks", []),
        "config.telemetry_sinks",
    )
    if not telemetry_sinks:
        raise TrialModeActivationError("config.telemetry_sinks must include at least one sink.")

    signal_trackers = _dedupe_preserve_order(
        config_copy.get("signal_trackers", []),
        "config.signal_trackers",
    )
    if not signal_trackers:
        raise TrialModeActivationError("config.signal_trackers must include at least one tracker.")

    yield_engine = config_copy.get("yield_engine")
    if not isinstance(yield_engine, Mapping):
        raise TrialModeActivationError("config.yield_engine must be a mapping.")

    retro_mode = _require_bool(yield_engine, "enable_retro_mode", "config.yield_engine")
    rewards_enabled = _require_bool(yield_engine, "rewards_enabled", "config.yield_engine")
    epoch_streaming = _require_bool(yield_engine, "epoch_streaming", "config.yield_engine")
    multiplier_sim = _require_string(yield_engine, "multiplier_sim", "config.yield_engine")

    mesh_layer = config_copy.get("mesh_layer")
    if not isinstance(mesh_layer, Mapping):
        raise TrialModeActivationError("config.mesh_layer must be a mapping.")

    detect_ghostkey = _require_bool(mesh_layer, "detect_ghostkey", "config.mesh_layer")
    hidden_paths = _require_bool(mesh_layer, "enable_hidden_paths", "config.mesh_layer")
    prophecy_trigger = _require_bool(mesh_layer, "prophecy_trigger", "config.mesh_layer")

    governance_scrutiny = _require_string(config_copy, "governance_scrutiny", "config")
    traffic_simulation = _require_string(config_copy, "traffic_simulation", "config")
    auth_by = _require_string(config_copy, "auth_by", "config")

    activated_at = datetime.now(tz=timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

    normalized_config = {
        "telemetry_sinks": telemetry_sinks,
        "signal_trackers": signal_trackers,
        "yield_engine": {
            "enable_retro_mode": retro_mode,
            "rewards_enabled": rewards_enabled,
            "epoch_streaming": epoch_streaming,
            "multiplier_sim": multiplier_sim,
        },
        "mesh_layer": {
            "detect_ghostkey": detect_ghostkey,
            "enable_hidden_paths": hidden_paths,
            "prophecy_trigger": prophecy_trigger,
        },
        "governance_scrutiny": governance_scrutiny,
        "traffic_simulation": traffic_simulation,
        "auth_by": auth_by,
    }

    telemetry_summary = {
        "sinks": telemetry_sinks,
        "trackers": signal_trackers,
        "validation": "enabled" if telemetry_sinks else "pending",
        "ingestion_active": bool(telemetry_sinks and signal_trackers),
    }

    signal_summary = {
        "intent_channels": signal_trackers,
        "loop_scanner_active": "LoopScanner" in signal_trackers,
        "prophecy_watch": prophecy_trigger,
    }

    flags = {
        "rewards_preview": rewards_enabled,
        "retro_mode": retro_mode,
        "epoch_streaming": epoch_streaming,
        "prophecy_watch": prophecy_trigger,
        "ghostkey_detected": detect_ghostkey,
    }

    summary = (
        f"ForgeTrail trial '{codename_value}' activated for {identity_value}. "
        f"Telemetry sinks: {', '.join(telemetry_sinks) or 'none'}. "
        f"Signal trackers: {', '.join(signal_trackers) or 'none'}."
    )

    return {
        "status": "activated",
        "identity": identity_value,
        "wallet_id": wallet_value,
        "trial_codename": codename_value,
        "activated_at": activated_at,
        "config": normalized_config,
        "telemetry": telemetry_summary,
        "signals": signal_summary,
        "flags": flags,
        "governance": {
            "scrutiny": governance_scrutiny,
            "auth": auth_by,
        },
        "traffic_simulation": traffic_simulation,
        "summary": summary,
    }
