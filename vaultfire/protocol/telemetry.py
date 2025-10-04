"""Telemetry helpers for orchestrating trace streams."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict
from uuid import uuid4

_REPO_ROOT = Path(__file__).resolve().parents[2]
_TRACE_STREAM_PATH = _REPO_ROOT / "telemetry" / "trace_stream.log"


def activate_trace_stream(wallet_id: str, *, simulation_mode: bool = False) -> Dict[str, Any]:
    """Record activation of a telemetry trace stream for ``wallet_id``.

    The function appends a JSON line to ``telemetry/trace_stream.log`` containing
    the wallet, trace identifier, and execution metadata so downstream tools can
    subscribe to the synthetic stream during simulations.
    """

    if not wallet_id or not wallet_id.strip():
        raise ValueError("wallet_id must be a non-empty string")

    event = {
        "trace_id": uuid4().hex,
        "wallet_id": wallet_id.strip(),
        "mode": "simulation" if simulation_mode else "live",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    _TRACE_STREAM_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _TRACE_STREAM_PATH.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event) + "\n")

    return event


__all__ = ["activate_trace_stream"]
