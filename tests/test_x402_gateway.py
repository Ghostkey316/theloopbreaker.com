from __future__ import annotations

import json

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
    reason="[optional] cryptography is required for x402 gateway tests",
)

if CRYPTOGRAPHY_AVAILABLE:
    from vaultfire.storage import DailyBackupManager
    from vaultfire.x402_gateway import (
        X402Gateway,
        X402PaymentRequired,
        X402Rule,
    )
else:  # pragma: no cover - placeholders when dependency missing
    DailyBackupManager = None  # type: ignore[assignment]
    X402Gateway = X402PaymentRequired = X402Rule = None  # type: ignore[assignment]


def test_execute_records_payment(tmp_path):
    ledger_path = tmp_path / "ledger.jsonl"
    memory_path = tmp_path / "memory.jsonl"
    backup_manager = DailyBackupManager(base_dir=tmp_path / "backups")
    gateway = X402Gateway(
        ledger_path=ledger_path,
        codex_memory_path=memory_path,
        ghostkey_earnings_path=tmp_path / "ghostkey.jsonl",
        companion_path=tmp_path / "companion.jsonl",
        backup_manager=backup_manager,
    )

    def _callback() -> dict[str, str]:
        return {"ok": "yes"}

    result = gateway.execute(
        "codex.run_passive_loop",
        _callback,
        signature="codex::test",
    )
    assert result == {"ok": "yes"}

    ledger_lines = ledger_path.read_text(encoding="utf-8").splitlines()
    assert ledger_lines, "ledger should contain the payment record"
    entry = json.loads(ledger_lines[-1])
    assert entry["event"] == "payment"
    assert entry["endpoint"] == "codex.run_passive_loop"
    assert entry["identity_handle"]
    assert entry["metadata"]["ghostkey_mode"] is True
    assert entry["metadata"]["wallet_classification"] == "ghostkey"
    assert memory_path.exists()

    manifest_path = tmp_path / "backups" / "last_snapshot.json"
    manifest = json.loads(manifest_path.read_text())
    resources = manifest.get("resources", {})
    assert {"ledger", "memory", "companion"}.issubset(resources)
    for payload in resources.values():
        assert payload.get("checksum"), "daily backups must record checksums"


def test_payment_required_when_under_threshold(tmp_path):
    backup_manager = DailyBackupManager(base_dir=tmp_path / "backups")
    gateway = X402Gateway(
        ledger_path=tmp_path / "ledger.jsonl",
        codex_memory_path=tmp_path / "memory.jsonl",
        ghostkey_earnings_path=tmp_path / "ghostkey.jsonl",
        companion_path=tmp_path / "companion.jsonl",
        backup_manager=backup_manager,
    )
    rule = X402Rule(
        endpoint="test.strict",
        category="test",
        description="Strict payment requirement",
        minimum_charge=0.5,
        currency="ETH",
    )
    gateway.register_rule(rule)

    with pytest.raises(X402PaymentRequired):
        gateway.execute(
            "test.strict",
            lambda: None,
            amount=0.1,
            currency="ETH",
            signature="codex::test",
        )


def test_describe_rules_contains_cli_gate(tmp_path):
    backup_manager = DailyBackupManager(base_dir=tmp_path / "backups")
    gateway = X402Gateway(
        ledger_path=tmp_path / "ledger.jsonl",
        codex_memory_path=tmp_path / "memory.jsonl",
        ghostkey_earnings_path=tmp_path / "ghostkey.jsonl",
        companion_path=tmp_path / "companion.jsonl",
        backup_manager=backup_manager,
    )
    rules = gateway.describe_rules()
    assert "cli.vaultfire.sh" in rules
    assert rules["cli.vaultfire.sh"]["category"] == "cli"

