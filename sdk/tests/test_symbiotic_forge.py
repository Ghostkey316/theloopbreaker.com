from __future__ import annotations

import sys
from pathlib import Path

import pytest

try:  # pragma: no cover - optional dependency for partner API clients
    import requests  # type: ignore  # noqa: F401
except ModuleNotFoundError:  # pragma: no cover - skip when HTTP client unavailable
    REQUESTS_AVAILABLE = False
else:  # pragma: no cover - executed only when dependency present
    REQUESTS_AVAILABLE = True


pytestmark = pytest.mark.skipif(
    not REQUESTS_AVAILABLE,
    reason="[optional] requests is required for SymbioticForge tests",
)

current_dir = Path(__file__).resolve()
sys.path.insert(0, str(current_dir.parents[1]))
sys.path.insert(0, str(current_dir.parents[2]))
if REQUESTS_AVAILABLE:
    from sdk import SymbioticForge
else:  # pragma: no cover - placeholder when dependency missing
    SymbioticForge = None  # type: ignore[assignment]


def test_attest_moral_loop_generates_tx_hash() -> None:
    forge = SymbioticForge("ghostkey316.eth")
    intent = {
        "alpha_power": 0.72,
        "theta_intent": "align",
        "proof": "demo-proof",
    }
    tx_hash = forge.attest_moral_loop(intent)
    assert isinstance(tx_hash, str)
    assert tx_hash.startswith("0x")
    assert len(tx_hash) == 66


def test_run_pilot_sim_returns_runs() -> None:
    forge = SymbioticForge("ghostkey316.eth")
    result = forge.run_pilot_sim("loyalty")
    assert result["pilot"] == "loyalty"
    assert isinstance(result["runs"], list)
    assert result["runs"]
    first = result["runs"][0]
    assert {"wallet", "gradient", "tx", "status"} <= set(first)
