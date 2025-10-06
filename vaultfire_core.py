"""Legacy compatibility shim for :mod:`vaultfire.core`."""

from __future__ import annotations

from vaultfire.core import (
    CoreConfig as VaultfireConfig,
    PurposeStore,
    cli_belief,
    get_purpose_store,
    get_recent_purpose_records,
    load_core_config,
    load_vaultfire_config,
    protocol_notify,
    reset_vaultfire_state,
    sync_purpose,
)

__all__ = [
    "VaultfireConfig",
    "PurposeStore",
    "cli_belief",
    "get_purpose_store",
    "get_recent_purpose_records",
    "load_core_config",
    "load_vaultfire_config",
    "protocol_notify",
    "reset_vaultfire_state",
    "sync_purpose",
]
