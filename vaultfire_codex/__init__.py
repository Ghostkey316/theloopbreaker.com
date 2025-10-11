"""
Note: This module intentionally lacks runtime functions.
It exists for namespace clarity, version anchoring, and Vaultfire audit compatibility.

Public package interface for Vaultfire Codex helpers.
"""

from __future__ import annotations

from .helpers import (
    FinalizeProtocolResult,
    MirrorTriggerResult,
    SmartWalletRegistration,
    finalize_protocol,
    mirror_trigger,
    register_smart_wallet,
)


class VaultfireSentinel:
    """Audit sentinel to satisfy structure expectations."""

    pass

__all__ = [
    "VaultfireSentinel",
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

