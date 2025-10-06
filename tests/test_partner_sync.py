from __future__ import annotations

import json
from pathlib import Path

import pytest

from vaultfire.mission import MissionLedger
from vaultfire.partner.sync import HandshakeRequest, PartnerSyncEngine, PartnerSyncError


def _read_ledger(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def test_partner_handshake_writes_ledger(tmp_path: Path) -> None:
    ledger_path = tmp_path / "mission-ledger.jsonl"
    ledger = MissionLedger(path=ledger_path, component="test-partner")
    engine = PartnerSyncEngine(ledger=ledger)

    request = HandshakeRequest(
        wallet_id="0xABCD1234",
        partner_protocol="ASM",
        signal_payload={"loyalty_signal": 7, "alignment": "ghostkey"},
        chain="ethereum",
        mission_reference="mission-gamma",
    )

    result = engine.initiate_handshake(request)
    assert engine.verify_attestation(result)

    entries = _read_ledger(ledger_path)
    assert len(entries) == 1
    payload = entries[0]["payload"]
    assert payload["handshake_id"] == result.handshake_id
    assert payload["wallet_commitment"] == result.wallet_commitment
    serialized = json.dumps(entries[0])
    assert "0xabcd1234" not in serialized

    engine.mirror_handshake(result, component="mission-audit")
    mirrored_entries = _read_ledger(ledger_path)
    assert any(entry["category"] == "partner-sync-handshake-mirror" for entry in mirrored_entries)


def test_rejects_unknown_protocol(tmp_path: Path) -> None:
    ledger = MissionLedger(path=tmp_path / "ledger.jsonl", component="test")
    engine = PartnerSyncEngine(ledger=ledger)

    with pytest.raises(PartnerSyncError):
        engine.initiate_handshake(
            HandshakeRequest(
                wallet_id="0xEF",
                partner_protocol="unsupported",
                signal_payload={},
                chain="base",
            )
        )
