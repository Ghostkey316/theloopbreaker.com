"""Vaultfire codex activation helpers."""

from __future__ import annotations

import hashlib
import json
import os
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Mapping, MutableMapping, Sequence

__all__ = ["finalize_protocol", "mirror_trigger", "FinalizeProtocolResult", "MirrorTriggerResult"]

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
    ethics_framework: str,
    contributor_id: str,
    ens: str,
    main_wallet: str,
    modules: Sequence[str],
    gui_hooks: bool,
    partner_plugin_support: bool,
    relay_ready: bool,
    zkmirror_sync: bool,
    secure_cli_export: bool,
    retro_reward_trace: bool,
    telemetry_opt_in: bool,
    fallback_audit_route: str,
    mirror_activation_window: str,
    moral_fingerprint_mode: str,
    runtime_validation: bool,
    loyalty_proof_snapshot: str,
    codex_signature: str,
) -> FinalizeProtocolResult:
    """Record a protocol finalization event and return a structured summary."""

    normalized_modules = _normalize_modules(modules)
    timestamp = datetime.now(timezone.utc).isoformat()

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

    checksum_payload = {
        "contributor_id": contributor_id,
        "ens": ens,
        "main_wallet": main_wallet,
        "modules": normalized_modules,
        "options": options,
        "codex_signature": codex_signature,
        "timestamp": timestamp,
    }
    checksum = _generate_checksum(checksum_payload)

    result = FinalizeProtocolResult(
        contributor_id=contributor_id,
        ens=ens,
        main_wallet=main_wallet,
        modules=normalized_modules,
        options=options,
        codex_signature=codex_signature,
        timestamp=timestamp,
        checksum=checksum,
    )

    log_payload = asdict(result)
    log_payload["event"] = "finalize_protocol"
    _append_json_line(_resolve_log_path(_DEFAULT_FINALIZATION_LOG), log_payload)
    return result


def mirror_trigger(
    *,
    fork_ready: bool,
    beliefnet_activation: bool,
    dao_init_signal: bool,
    contributor_file_visibility: str,
    vaultfire_cli_mode: str,
    ens_record_update: str,
    relay_index: str,
    zk_proof_mode: str,
    notify_on_success: Iterable[str],
) -> MirrorTriggerResult:
    """Record a mirror trigger event and return a structured summary."""

    notifications = tuple(sorted({name.strip() for name in notify_on_success if name.strip()}))
    timestamp = datetime.now(timezone.utc).isoformat()

    options = {
        "fork_ready": bool(fork_ready),
        "beliefnet_activation": bool(beliefnet_activation),
        "dao_init_signal": bool(dao_init_signal),
    }

    checksum_payload = {
        "contributor_visibility": contributor_file_visibility,
        "vaultfire_cli_mode": vaultfire_cli_mode,
        "ens_record_update": ens_record_update,
        "relay_index": relay_index,
        "zk_proof_mode": zk_proof_mode,
        "notifications": notifications,
        "options": options,
        "timestamp": timestamp,
    }
    checksum = _generate_checksum(checksum_payload)

    result = MirrorTriggerResult(
        contributor_visibility=contributor_file_visibility,
        vaultfire_cli_mode=vaultfire_cli_mode,
        ens_record_update=ens_record_update,
        relay_index=relay_index,
        zk_proof_mode=zk_proof_mode,
        notifications=notifications,
        options=options,
        timestamp=timestamp,
        checksum=checksum,
    )

    log_payload = asdict(result)
    log_payload["event"] = "mirror_trigger"
    _append_json_line(_resolve_log_path(_DEFAULT_MIRROR_LOG), log_payload)
    return result
