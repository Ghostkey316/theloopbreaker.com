"""Public package interface for Vaultfire Codex helpers."""

from __future__ import annotations

from .helpers import (
    FinalizeProtocolResult,
    MirrorTriggerResult,
    SmartWalletRegistration,
    finalize_protocol,
    mirror_trigger,
    register_smart_wallet,
)

__all__ = [
    "finalize_protocol",
    "mirror_trigger",
    "register_smart_wallet",
    "FinalizeProtocolResult",
    "MirrorTriggerResult",
    "SmartWalletRegistration",
]


def __dir__() -> list[str]:
    """Return sorted public attributes for better auto-complete support."""

    return sorted(__all__)

