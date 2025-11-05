from __future__ import annotations
from pathlib import Path

import pytest

try:  # pragma: no cover - optional dependency powering encryption pipeline
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM  # type: ignore  # noqa: F401
    from cryptography.exceptions import InvalidTag  # type: ignore  # noqa: F401
except (ImportError, ModuleNotFoundError):  # pragma: no cover - skip module when unavailable
    CRYPTOGRAPHY_AVAILABLE = False
else:  # pragma: no cover - executed when dependency present
    CRYPTOGRAPHY_AVAILABLE = True


pytestmark = pytest.mark.skipif(
    not CRYPTOGRAPHY_AVAILABLE,
    reason="[optional] cryptography is required for x402 dashboard tests",
)

if CRYPTOGRAPHY_AVAILABLE:
    from vaultfire.x402_dashboard import (
        aggregate_totals,
        export_dashboard,
        load_dashboard_entries,
    )
    from vaultfire.x402_gateway import X402Gateway
else:  # pragma: no cover - placeholders when dependency missing
    aggregate_totals = export_dashboard = load_dashboard_entries = None  # type: ignore[assignment]
    X402Gateway = None  # type: ignore[assignment]


def test_dashboard_loading_and_export(tmp_path):
    gateway = X402Gateway(
        ledger_path=tmp_path / "ledger.jsonl",
        codex_memory_path=tmp_path / "memory.jsonl",
        ghostkey_earnings_path=tmp_path / "ghostkey.jsonl",
        companion_path=tmp_path / "companion.jsonl",
    )
    gateway.record_external_event(
        event_type="payment",
        status="confirmed",
        amount=2.0,
        currency="ETH",
        metadata={"tx_hash": "0x1"},
    )
    entries = load_dashboard_entries(limit=5, gateway=gateway)
    assert entries
    totals = aggregate_totals(entries)
    assert totals["ETH"] == 2.0

    export_path = tmp_path / "dashboard.vaultledger"
    export_dashboard(entries, export_path)
    assert export_path.exists()

    export_json = tmp_path / "dashboard.json"
    export_dashboard(entries, export_json, format="json")
    assert export_json.exists()
