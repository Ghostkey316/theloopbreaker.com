"""Ledger logging utilities for GhostKey interactions."""

from __future__ import annotations

import logging
from typing import Any, Mapping

__all__ = ["get_ghostkey_logger", "log_ghostkey_interaction"]

_LOGGER_NAME = "vaultfire.ghostkey"


def get_ghostkey_logger() -> logging.Logger:
    """Return the configured logger for GhostKey interactions."""

    logger = logging.getLogger(_LOGGER_NAME)
    if not logger.handlers:
        logger.addHandler(logging.NullHandler())
    return logger


def log_ghostkey_interaction(
    action: str,
    *,
    node_id: str,
    layer: str,
    payload: Mapping[str, Any] | None = None,
) -> None:
    """Emit a structured log entry for a GhostKey interaction."""

    logger = get_ghostkey_logger()
    record = {
        "action": str(action),
        "node_id": str(node_id),
        "layer": str(layer),
        "payload": dict(payload or {}),
    }
    logger.info("ghostkey.interaction", extra={"ghostkey": record})
