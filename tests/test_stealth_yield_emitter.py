from __future__ import annotations

import importlib
import json
from pathlib import Path

import pytest

from vaultfire.mission import MissionLedger

stealth_module = importlib.import_module("vaultfire.yield.stealth_emitter")
StealthYieldBatch = getattr(stealth_module, "StealthYieldBatch")
StealthYieldEmitter = getattr(stealth_module, "StealthYieldEmitter")


def _read_ledger(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def test_emitter_produces_attested_batch(tmp_path: Path) -> None:
    ledger_path = tmp_path / "ledger.jsonl"
    ledger = MissionLedger(path=ledger_path, component="test-stealth-yield")
    emitter = StealthYieldEmitter(ledger=ledger)

    distribution_one = emitter.build_distribution(
        wallet_id="0xabc1",
        amount=10.5,
        loyalty_points=1.0,
        traits={"mission": "gamma"},
    )
    distribution_two = emitter.build_distribution(
        wallet_id="0xabc2",
        amount=5.25,
        loyalty_points=0.5,
    )

    batch = emitter.emit(
        mission_event="mission-gamma",
        chain="ethereum",
        distributions=[distribution_one, distribution_two],
        attestation_context={"handshake_id": "handshake-123"},
    )
    assert isinstance(batch, StealthYieldBatch)
    assert emitter.verify_batch(batch)
    assert len(batch.wallet_commitments) == 2

    rollback_record_id = emitter.request_rollback(batch, reason="alignment-check")
    assert rollback_record_id

    dispute_resolution = emitter.resolve_dispute(
        batch,
        wallet_commitment=batch.wallet_commitments[0],
        evidence={"note": "resolved"},
    )
    assert dispute_resolution["wallet_commitment"] == batch.wallet_commitments[0]

    entries = _read_ledger(ledger_path)
    categories = {entry["category"] for entry in entries}
    assert {"stealth-yield-batch", "stealth-yield-rollback", "stealth-yield-dispute"}.issubset(categories)
    serialized = json.dumps(entries)
    assert "0xabc1" not in serialized


def test_emitter_validates_distribution_amounts(tmp_path: Path) -> None:
    emitter = StealthYieldEmitter(ledger=MissionLedger(path=tmp_path / "ledger.jsonl"))

    with pytest.raises(ValueError):
        emitter.build_distribution(wallet_id="0xabc", amount=0, loyalty_points=0)

    with pytest.raises(ValueError):
        emitter.build_distribution(wallet_id="0xabc", amount=1, loyalty_points=-1)
