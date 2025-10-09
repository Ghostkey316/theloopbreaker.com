"""Public package interface for Vaultfire Codex helpers."""

from __future__ import annotations

from .helpers import (
    FinalizeProtocolResult,
    MirrorTriggerResult,
    finalize_protocol,
    mirror_trigger,
)

__all__ = [
    "finalize_protocol",
    "mirror_trigger",
    "FinalizeProtocolResult",
    "MirrorTriggerResult",
]


def __dir__() -> list[str]:
    """Return sorted public attributes for better auto-complete support."""

    return sorted(__all__)

