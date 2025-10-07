"""Core routines for activating the Vaultfire trial protocol."""
from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Mapping, MutableMapping, Optional, Sequence, Union

from .identity import IdentityRecord
from .utils import TraceHook

__all__ = [
    "ActivationResult",
    "TrialModeActivationError",
    "activate_trial_mode",
]

IdentityInput = Union[str, IdentityRecord]


class TrialModeActivationError(ValueError):
    """Raised when the ForgeTrail trial activation payload is invalid."""


class ActivationResult(dict):
    """Dictionary-style activation payload that also exposes attribute access."""

    __slots__ = ()

    def __getattr__(self, item: str) -> Any:  # pragma: no cover - trivial attribute delegation
        try:
            return self[item]
        except KeyError as exc:  # pragma: no cover - error path
            raise AttributeError(item) from exc

    def __setattr__(self, key: str, value: Any) -> None:  # pragma: no cover - immutable attributes
        raise AttributeError("ActivationResult attributes are read-only")


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


def _normalize_identity(identity: IdentityInput) -> str:
    if isinstance(identity, IdentityRecord):
        return _validate_non_empty_string(identity.address, "identity.address")
    return _validate_non_empty_string(identity, "identity")


def _activate_with_config(
    *,
    identity_value: str,
    wallet_id: str,
    trial_codename: str,
    config: MutableMapping[str, Any],
) -> ActivationResult:
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

    activated_at = (
        datetime.now(tz=timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )

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
        f"ForgeTrail trial '{trial_codename}' activated for {identity_value}. "
        f"Telemetry sinks: {', '.join(telemetry_sinks) or 'none'}. "
        f"Signal trackers: {', '.join(signal_trackers) or 'none'}."
    )

    return ActivationResult(
        status="activated",
        identity=identity_value,
        wallet_id=wallet_id,
        trial_codename=trial_codename,
        activated_at=activated_at,
        config=normalized_config,
        telemetry=telemetry_summary,
        signals=signal_summary,
        flags=flags,
        governance={
            "scrutiny": governance_scrutiny,
            "auth": auth_by,
        },
        traffic_simulation=traffic_simulation,
        summary=summary,
    )


def _normalize_trace_hooks(trace_hooks: Optional[Iterable[TraceHook]]) -> List[TraceHook]:
    hooks: List[TraceHook] = []
    for hook in trace_hooks or ():
        if not isinstance(hook, TraceHook):
            raise TrialModeActivationError("trace_hooks entries must be TraceHook instances.")
        hooks.append(hook)
    return hooks


def activate_trial_mode(
    *,
    identity: IdentityInput,
    wallet_id: Optional[str] = None,
    trial_codename: Optional[str] = None,
    config: Optional[MutableMapping[str, Any]] = None,
    enable_telemetry: Optional[bool] = None,
    enable_signal: Optional[bool] = None,
    enable_governance: Optional[bool] = None,
    trace_hooks: Optional[Iterable[TraceHook]] = None,
) -> ActivationResult:
    """Validate and normalize a Ghostfire ForgeTrail trial activation payload."""

    # Legacy path that uses an explicit config mapping
    if config is not None or wallet_id is not None or trial_codename is not None:
        if config is None or wallet_id is None or trial_codename is None:
            raise TrialModeActivationError(
                "wallet_id, trial_codename, and config must all be provided for the config-driven path."
            )
        identity_value = _normalize_identity(identity)
        wallet_value = _validate_non_empty_string(wallet_id, "wallet_id")
        codename_value = _validate_non_empty_string(trial_codename, "trial_codename")
        return _activate_with_config(
            identity_value=identity_value,
            wallet_id=wallet_value,
            trial_codename=codename_value,
            config=config,
        )

    # Modern path that assembles the config based on enable flags and trace hooks
    if not isinstance(identity, IdentityRecord):
        raise TrialModeActivationError(
            "When config is omitted identity must be an IdentityRecord loaded via IdentityManager."
        )

    if enable_telemetry is None or enable_signal is None or enable_governance is None:
        raise TrialModeActivationError(
            "enable_telemetry, enable_signal, and enable_governance must be provided when config is omitted."
        )

    hooks = _normalize_trace_hooks(trace_hooks)
    telemetry_sinks = [hook.name for hook in hooks if hook.supports("telemetry")]
    signal_trackers = [hook.name for hook in hooks if hook.supports("signal")]

    if not telemetry_sinks:
        telemetry_sinks = ["trial_mode_telemetry"]
    if not signal_trackers:
        signal_trackers = ["trial_mode_signal"]

    generated_config: MutableMapping[str, Any] = {
        "telemetry_sinks": telemetry_sinks,
        "signal_trackers": signal_trackers,
        "yield_engine": {
            "enable_retro_mode": bool(enable_signal or enable_governance),
            "rewards_enabled": bool(enable_governance),
            "epoch_streaming": bool(enable_telemetry),
            "multiplier_sim": "golden_trial_mode",
        },
        "mesh_layer": {
            "detect_ghostkey": True,
            "enable_hidden_paths": bool(enable_signal),
            "prophecy_trigger": bool(enable_governance),
        },
        "governance_scrutiny": "golden_liveflow" if enable_governance else "observer_review",
        "traffic_simulation": "Golden Trial Telemetry" if enable_telemetry else "Manual Observer",
        "auth_by": identity.alias,
    }

    result = _activate_with_config(
        identity_value=_normalize_identity(identity),
        wallet_id=_validate_non_empty_string(identity.default_wallet_id, "identity.default_wallet_id"),
        trial_codename=_validate_non_empty_string(
            trial_codename or identity.default_trial_codename,
            "trial_codename",
        ),
        config=generated_config,
    )

    result.update(
        ActivationResult(
            telemetry_status="enabled" if enable_telemetry else "disabled",
            signal_status="enabled" if enable_signal else "disabled",
            governance_status="enabled" if enable_governance else "disabled",
            trace_hooks=[hook.summary() for hook in hooks],
            identity_alias=identity.alias,
        )
    )

    return result
