from __future__ import annotations

import json
from pathlib import Path

from vaultfire.mission import MissionLedger
from vaultfire.partner.sync import HandshakeRequest, PartnerSyncEngine
from vaultfire.token_registry import TokenRegistryRecord, VaultfireTokenRegistry


def _read_ledger(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def test_registry_maps_signal_and_mints_yield(tmp_path: Path) -> None:
    ledger_path = tmp_path / "ledger.jsonl"
    ledger = MissionLedger(path=ledger_path, component="test-token-registry")
    engine = PartnerSyncEngine(ledger=ledger)
    registry = VaultfireTokenRegistry(ledger=ledger)

    handshake = engine.initiate_handshake(
        HandshakeRequest(
            wallet_id="0x998877",
            partner_protocol="ASM",
            signal_payload={"score": 88},
            chain="base",
        )
    )

    registration = registry.register_wallet("0x998877", chain="base", traits={"tier": "silver"})
    assert registry.is_wallet_registered("0x998877", chain="base")

    record = registry.map_yield_signal(
        wallet_id="0x998877",
        chain="base",
        signal_type="loyalty",
        payload={"boost": 1.25},
        handshake=handshake,
    )
    assert isinstance(record, TokenRegistryRecord)
    assert record.wallet_commitment == registration.commitment
    assert record.chain == "base"

    batch = registry.stealth_mint_yield(
        wallet_id="0x998877",
        chain="base",
        mission_event="mission-gamma",
        amount=42.5,
        handshake=handshake,
        loyalty_points=5.0,
    )
    assert registry.supported_chains
    assert batch.wallet_commitments[0] == registration.commitment

    entries = _read_ledger(ledger_path)
    categories = {entry["category"] for entry in entries}
    assert "token-registry-registration" in categories
    assert "token-registry-signal" in categories
    assert "token-registry-yield" in categories
    serialized = json.dumps(entries)
    assert "0x998877" not in serialized
