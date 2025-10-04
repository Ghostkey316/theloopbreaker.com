"""Yield activation simulation helpers."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List
from uuid import uuid4

from ghostyield_simulator import GhostYieldSimulator

_REPO_ROOT = Path(__file__).resolve().parents[2]
_YIELD_LOG = _REPO_ROOT / "telemetry" / "yield_activation.log"

_DEFAULT_SEGMENTS: List[tuple[int, float]] = [
    (3, 1.12),
    (5, 1.18),
    (8, 1.24),
]


def _normalize_wallet(wallet_id: str) -> str:
    if not wallet_id or not wallet_id.strip():
        raise ValueError("wallet_id must be provided")
    return wallet_id.strip()


def simulate_yield_activation(
    *,
    wallet_id: str,
    mission_tag: str,
    simulate_loop: bool = False,
    wallet_segments: Iterable[tuple[int, float]] | None = None,
) -> Dict[str, Any]:
    """Simulate an activation-to-yield loop and persist telemetry."""

    normalized_wallet = _normalize_wallet(wallet_id)
    if not mission_tag or not mission_tag.strip():
        raise ValueError("mission_tag must be provided")

    simulator = GhostYieldSimulator()
    segments = list(wallet_segments or _DEFAULT_SEGMENTS)
    scenarios = simulator.simulate(segments)
    export_path = simulator.export()

    activation_event = {
        "activation_id": uuid4().hex,
        "wallet_id": normalized_wallet,
        "mission_tag": mission_tag.strip(),
        "simulate_loop": simulate_loop,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "segments": [
            {"wallet_count": count, "belief_multiplier": multiplier}
            for count, multiplier in segments
        ],
        "scenarios": [scenario.as_dict() for scenario in scenarios],
        "export_path": str(export_path.relative_to(_REPO_ROOT)),
        "loop_iterations": len(scenarios) if simulate_loop else 1,
    }

    _YIELD_LOG.parent.mkdir(parents=True, exist_ok=True)
    with _YIELD_LOG.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(activation_event) + "\n")

    return activation_event


__all__ = ["simulate_yield_activation"]
