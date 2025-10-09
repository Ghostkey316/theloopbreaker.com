"""Implementation helpers for :mod:`vaultfire_codex`."""

from __future__ import annotations

import hashlib
import json
import os
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Mapping, MutableMapping, Sequence

__all__ = [
    "finalize_protocol",
    "mirror_trigger",
    "FinalizeProtocolResult",
    "MirrorTriggerResult",
]

_LOG_DIR_ENV = "VAULTFIRE_CODEX_LOG_DIR"
_DEFAULT_FINALIZATION_LOG = "codex_finalization_log.jsonl"
_DEFAULT_MIRROR_LOG = "codex_mirror_trigger_log.jsonl"


@dataclass(frozen=True)
class FinalizeProtocolResult:
    """Structured record returned by :func:`finalize_protocol`."""

    contributor_id: str
    ens: str
    main_wallet: str
    modules: tuple[str, ...]
    options: Mapping[str, object]
    codex_signature: str
    timestamp: str
    checksum: str


@dataclass(frozen=True)
class MirrorTriggerResult:
    """Structured record returned by :func:`mirror_trigger`."""

    contributor_visibility: str
    vaultfire_cli_mode: str
    ens_record_update: str
    relay_index: str
    zk_proof_mode: str
    notifications: tuple[str, ...]
    options: Mapping[str, object]
    timestamp: str
    checksum: str


def _resolve_log_path(filename: str) -> Path:
    base = os.getenv(_LOG_DIR_ENV)
    if base:
        path = Path(base).expanduser()
    else:
        path = Path(__file__).resolve().parents[1] / "status"
    path.mkdir(parents=True, exist_ok=True)
    return path / filename


def _append_json_line(path: Path, payload: Mapping[str, object]) -> None:
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload, sort_keys=True) + "\n")


def _normalize_modules(modules: Sequence[str]) -> tuple[str, ...]:
    if not isinstance(modules, Sequence) or isinstance(modules, (str, bytes)):
        raise TypeError("modules must be a sequence of strings")

    seen: MutableMapping[str, None] = {}
    for module in modules:
        if not isinstance(module, str) or not module.strip():
            raise ValueError("modules must contain non-empty strings")
        key = module.strip()
        if key not in seen:
            seen[key] = None
    normalized = tuple(seen.keys())
    if not normalized:
        raise ValueError("modules must contain at least one entry")
    return normalized


def _generate_checksum(payload: Mapping[str, object]) -> str:
    encoded = json.dumps(payload, sort_keys=True).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def finalize_protocol(
    *,
    ethics_framework: str | None = None,
    contributor_id: str | None = None,
    ens: str | None = None,
    main_wallet: str | None = None,
    modules: Sequence[str] | None = None,
    gui_hooks: bool | None = None,
    partner_plugin_support: bool | None = None,
    relay_ready: bool | None = None,
    zkmirror_sync: bool | None = None,
    secure_cli_export: bool | None = None,
    retro_reward_trace: bool | None = None,
    telemetry_opt_in: bool | None = None,
    fallback_audit_route: str | None = None,
    mirror_activation_window: str | None = None,
    moral_fingerprint_mode: str | None = None,
    runtime_validation: bool | None = None,
    loyalty_proof_snapshot: str | None = None,
    codex_signature: str | None = None,
    session_id: str | None = None,
    origin_wallet: str | None = None,
    trigger_reason: str | None = None,
    notify_on_success: Iterable[str] | None = None,
) -> FinalizeProtocolResult:
    """Record a protocol finalization event and return a structured summary."""

    timestamp = datetime.now(timezone.utc).isoformat()

    simple_inputs_provided = any(
        value is not None
        for value in (session_id, origin_wallet, trigger_reason, notify_on_success)
    )
    legacy_inputs_provided = any(
        value is not None
        for value in (
            ethics_framework,
            contributor_id,
            ens,
            main_wallet,
            modules,
            gui_hooks,
            partner_plugin_support,
            relay_ready,
            zkmirror_sync,
            secure_cli_export,
            retro_reward_trace,
            telemetry_opt_in,
            fallback_audit_route,
            mirror_activation_window,
            moral_fingerprint_mode,
            runtime_validation,
            loyalty_proof_snapshot,
            codex_signature,
        )
    )

    if simple_inputs_provided and legacy_inputs_provided:
        raise ValueError(
            "finalize_protocol cannot mix legacy and simplified argument styles"
        )

    if simple_inputs_provided:
        if session_id is None or origin_wallet is None or trigger_reason is None:
            raise TypeError(
                "session_id, origin_wallet, and trigger_reason are required when using the simplified finalize_protocol interface"
            )

        normalized_modules = _normalize_modules(
            modules if modules is not None else ("protocol.finalized",)
        )
        notifications = tuple(
            sorted(
                {
                    item.strip()
                    for item in (notify_on_success or [])
                    if isinstance(item, str) and item.strip()
                }
            )
        )

        options = {
            "mode": "simplified",
            "trigger_reason": trigger_reason,
            "notify_on_success": notifications,
        }

        contributor_value = contributor_id or session_id
        ens_value = ens or session_id
        main_wallet_value = origin_wallet
        codex_signature_value = codex_signature or f"simplified::{trigger_reason}"

    else:
        required_fields = {
            "ethics_framework": ethics_framework,
            "contributor_id": contributor_id,
            "ens": ens,
            "main_wallet": main_wallet,
            "modules": modules,
            "gui_hooks": gui_hooks,
            "partner_plugin_support": partner_plugin_support,
            "relay_ready": relay_ready,
            "zkmirror_sync": zkmirror_sync,
            "secure_cli_export": secure_cli_export,
            "retro_reward_trace": retro_reward_trace,
            "telemetry_opt_in": telemetry_opt_in,
            "fallback_audit_route": fallback_audit_route,
            "mirror_activation_window": mirror_activation_window,
            "moral_fingerprint_mode": moral_fingerprint_mode,
            "runtime_validation": runtime_validation,
            "loyalty_proof_snapshot": loyalty_proof_snapshot,
            "codex_signature": codex_signature,
        }
        missing = [name for name, value in required_fields.items() if value is None]
        if missing:
            raise TypeError(
                "Missing required arguments for finalize_protocol legacy interface: "
                + ", ".join(missing)
            )

        normalized_modules = _normalize_modules(modules)  # type: ignore[arg-type]
        options = {
            "ethics_framework": ethics_framework,
            "gui_hooks": bool(gui_hooks),
            "partner_plugin_support": bool(partner_plugin_support),
            "relay_ready": bool(relay_ready),
            "zkmirror_sync": bool(zkmirror_sync),
            "secure_cli_export": bool(secure_cli_export),
            "retro_reward_trace": bool(retro_reward_trace),
            "telemetry_opt_in": bool(telemetry_opt_in),
            "fallback_audit_route": fallback_audit_route,
            "mirror_activation_window": mirror_activation_window,
            "moral_fingerprint_mode": moral_fingerprint_mode,
            "runtime_validation": bool(runtime_validation),
            "loyalty_proof_snapshot": loyalty_proof_snapshot,
        }

        contributor_value = contributor_id  # type: ignore[assignment]
        ens_value = ens  # type: ignore[assignment]
        main_wallet_value = main_wallet  # type: ignore[assignment]
        codex_signature_value = codex_signature  # type: ignore[assignment]

    checksum_payload = {
        "contributor_id": contributor_value,
        "ens": ens_value,
        "main_wallet": main_wallet_value,
        "modules": normalized_modules,
        "options": options,
        "codex_signature": codex_signature_value,
        "timestamp": timestamp,
    }
    checksum = _generate_checksum(checksum_payload)

    result = FinalizeProtocolResult(
        contributor_id=contributor_value,
        ens=ens_value,
        main_wallet=main_wallet_value,
        modules=normalized_modules,
        options=options,
        codex_signature=codex_signature_value,
        timestamp=timestamp,
        checksum=checksum,
    )

    log_payload = asdict(result)
    log_payload["event"] = "finalize_protocol"
    _append_json_line(_resolve_log_path(_DEFAULT_FINALIZATION_LOG), log_payload)
    return result


def mirror_trigger(
    *,
    fork_ready: bool | None = None,
    beliefnet_activation: bool | None = None,
    dao_init_signal: bool | None = None,
    contributor_file_visibility: str | None = None,
    vaultfire_cli_mode: str | None = None,
    ens_record_update: str | None = None,
    relay_index: str | None = None,
    zk_proof_mode: str | None = None,
    notify_on_success: Iterable[str] | None = None,
    mirror_type: str | None = None,
    source: str | None = None,
    payload: Mapping[str, object] | None = None,
) -> MirrorTriggerResult:
    """Record a mirror trigger event and return a structured summary."""

    timestamp = datetime.now(timezone.utc).isoformat()

    simple_inputs_provided = any(value is not None for value in (mirror_type, source, payload))
    legacy_inputs_provided = any(
        value is not None
        for value in (
            fork_ready,
            beliefnet_activation,
            dao_init_signal,
            contributor_file_visibility,
            vaultfire_cli_mode,
            ens_record_update,
            relay_index,
            zk_proof_mode,
            notify_on_success,
        )
    )

    if simple_inputs_provided and legacy_inputs_provided:
        raise ValueError("mirror_trigger cannot mix legacy and simplified argument styles")

    if simple_inputs_provided:
        if payload is None:
            raise TypeError(
                "payload is required when using the simplified mirror_trigger interface"
            )
        if not isinstance(payload, Mapping):
            raise TypeError("payload must be a mapping when using the simplified interface")

        raw_notifications = notify_on_success or payload.get("notify_on_success", [])
        notifications = tuple(
            sorted(
                {
                    item.strip()
                    for item in (raw_notifications or [])
                    if isinstance(item, str) and item.strip()
                }
            )
        )

        contributor_visibility_value = f"{payload.get('auth', 'public')}::{payload.get('codex_state', 'unknown')}"
        vaultfire_cli_mode_value = mirror_type or str(payload.get("mirror_mode", "default"))
        ens_record_update_value = str(payload.get("ENS", ""))
        relay_index_value = source or str(payload.get("source", ""))
        zk_proof_mode_value = str(payload.get("integrity", "unspecified"))
        options = {
            "mode": "simplified",
            "payload": dict(payload),
            "mirror_type": mirror_type,
            "source": source,
            "yield_request": bool(payload.get("yield_request")),
            "public_display_ready": bool(payload.get("public_display_ready")),
        }

    else:
        required_fields = {
            "fork_ready": fork_ready,
            "beliefnet_activation": beliefnet_activation,
            "dao_init_signal": dao_init_signal,
            "contributor_file_visibility": contributor_file_visibility,
            "vaultfire_cli_mode": vaultfire_cli_mode,
            "ens_record_update": ens_record_update,
            "relay_index": relay_index,
            "zk_proof_mode": zk_proof_mode,
        }
        missing = [name for name, value in required_fields.items() if value is None]
        if missing:
            raise TypeError(
                "Missing required arguments for mirror_trigger legacy interface: "
                + ", ".join(missing)
            )

        notifications = tuple(
            sorted(
                {
                    name.strip()
                    for name in (notify_on_success or [])
                    if name.strip()
                }
            )
        )
        contributor_visibility_value = contributor_file_visibility  # type: ignore[assignment]
        vaultfire_cli_mode_value = vaultfire_cli_mode  # type: ignore[assignment]
        ens_record_update_value = ens_record_update  # type: ignore[assignment]
        relay_index_value = relay_index  # type: ignore[assignment]
        zk_proof_mode_value = zk_proof_mode  # type: ignore[assignment]
        options = {
            "fork_ready": bool(fork_ready),
            "beliefnet_activation": bool(beliefnet_activation),
            "dao_init_signal": bool(dao_init_signal),
        }

    checksum_payload = {
        "contributor_visibility": contributor_visibility_value,
        "vaultfire_cli_mode": vaultfire_cli_mode_value,
        "ens_record_update": ens_record_update_value,
        "relay_index": relay_index_value,
        "zk_proof_mode": zk_proof_mode_value,
        "notifications": notifications,
        "options": options,
        "timestamp": timestamp,
    }
    checksum = _generate_checksum(checksum_payload)

    result = MirrorTriggerResult(
        contributor_visibility=contributor_visibility_value,
        vaultfire_cli_mode=vaultfire_cli_mode_value,
        ens_record_update=ens_record_update_value,
        relay_index=relay_index_value,
        zk_proof_mode=zk_proof_mode_value,
        notifications=notifications,
        options=options,
        timestamp=timestamp,
        checksum=checksum,
    )

    log_payload = asdict(result)
    log_payload["event"] = "mirror_trigger"
    _append_json_line(_resolve_log_path(_DEFAULT_MIRROR_LOG), log_payload)
    return result

