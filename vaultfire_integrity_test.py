"""Integration checks for Vaultfire privacy patch v2."""

from __future__ import annotations

from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Mapping

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
    reason="[optional] cryptography is required for vaultfire integrity tests",
)

if CRYPTOGRAPHY_AVAILABLE:
    from codex_checker import CodexChecker
    from codex_redact import CodexRedactor
    from vaultfire.trust import record_belief_receipt, verify_receipt_integrity
    from vaultfire.pools import create_pool, register_contribution, schedule_passive_drop
    from vaultfire_payments import VaultfirePaymentRouter, detect_passive_income_signal
else:  # pragma: no cover - placeholders when dependency missing
    CodexChecker = CodexRedactor = None  # type: ignore[assignment]
    record_belief_receipt = verify_receipt_integrity = None  # type: ignore[assignment]
    create_pool = register_contribution = schedule_passive_drop = None  # type: ignore[assignment]
    VaultfirePaymentRouter = detect_passive_income_signal = None  # type: ignore[assignment]


def _create_dummy_proof() -> Mapping[str, object]:
    return {
        "outcome": "pass",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "inputs": {"redacted": True},
    }


def _exercise_payments() -> Mapping[str, object]:
    router = VaultfirePaymentRouter()
    router.register_endpoint(
        "belief/shielded", description="Shielded payment lane", minimum_charge=0.0
    )
    router.enable_shielded_mode()
    payload = {
        "amount": 0.0,
        "currency": "ETH",
        "ip": "198.51.100.1",
        "origin": "sensitive",
        "signal_type": "passive_yield",
    }
    passive = detect_passive_income_signal(payload)
    return router.process_request(payload, endpoint="belief/shielded", passive_income_signal=passive)


def _exercise_pools() -> Mapping[str, object]:
    pool = create_pool(
        f"pool-{int(datetime.now().timestamp())}",
        role="ghostkey",
        eligibility_proof={"signal": "belief"},
    )
    register_contribution(pool.pool_id, amount=1.25, evidence={"note": "sealed"})
    return schedule_passive_drop(pool.pool_id, pool.role, cadence="weekly")


def _exercise_redactor() -> None:
    tmp_memory = Path(".tmp_codex_memory")
    tmp_memory.write_text(
        "ghost_entry={'timestamp': '2000-01-01T00:00:00+00:00'}\nrecent={'timestamp': '2099-01-01T00:00:00+00:00'}",
        encoding="utf-8",
    )
    redactor = CodexRedactor(memory_path=tmp_memory)
    redactor.expire_after(hours=1, archive=False)
    redactor.signal("!ghostkey_vanish", archive=False)
    if tmp_memory.exists():
        tmp_memory.unlink()


def run() -> Mapping[str, object]:
    proof = _create_dummy_proof()
    receipt = record_belief_receipt(proof)
    assert verify_receipt_integrity(receipt.proof_hash)
    payment_result = _exercise_payments()
    pool_payload = _exercise_pools()
    _exercise_redactor()
    report = CodexChecker().run().as_dict()
    return {
        "receipt": receipt.to_public_payload(),
        "payment": payment_result,
        "pool": pool_payload,
        "codex_report": report,
    }


if __name__ == "__main__":
    result = run()
    print(json.dumps(result, indent=2, sort_keys=True))
