"""Tests for the Vaultfire pilot mode namespace."""

from __future__ import annotations

import hashlib
import hmac
import json
import os

import pytest

from utils.crypto import derive_key, decrypt_text
from vaultfire.pilot_mode import PilotAccessLayer
from vaultfire.pilot_mode import storage as pilot_storage


@pytest.fixture(autouse=True)
def isolated_pilot_storage(tmp_path, monkeypatch):
    """Isolate pilot mode storage to a temporary directory for tests."""

    monkeypatch.setattr(pilot_storage, "PILOT_MODE_ROOT", tmp_path)
    monkeypatch.setattr(pilot_storage, "PRIVATE_LEDGER_ROOT", tmp_path / "private")
    monkeypatch.setattr(pilot_storage, "PARTNER_REGISTRY_PATH", tmp_path / "partners.json")
    monkeypatch.setattr(pilot_storage, "PROTOCOL_KEYS_PATH", tmp_path / "protocol_keys.json")
    monkeypatch.setattr(pilot_storage, "SESSION_LOG_PATH", tmp_path / "sessions.jsonl")
    monkeypatch.setattr(pilot_storage, "YIELD_LOG_PATH", tmp_path / "yield.jsonl")
    monkeypatch.setattr(pilot_storage, "BEHAVIOR_LOG_PATH", tmp_path / "behavior.jsonl")
    monkeypatch.setattr(pilot_storage, "FEEDBACK_LOG_PATH", tmp_path / "feedback.jsonl")
    private_path = tmp_path / "private" / "pilot_refs.jsonl"
    monkeypatch.setattr(pilot_storage, "PRIVATE_REFERENCE_LOG_PATH", private_path)
    monkeypatch.setenv("VAULTFIRE_PILOT_SECRET", "test-secret")
    yield


def _load_references() -> list[tuple[dict, dict]]:
    path = pilot_storage.PRIVATE_REFERENCE_LOG_PATH
    if not path.exists():
        return []
    key = derive_key(os.environ["VAULTFIRE_PILOT_SECRET"])
    entries: list[tuple[dict, dict]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        entry = json.loads(line)
        payload = json.loads(decrypt_text(key, entry["payload_token"]))
        entries.append((entry, payload))
    return entries


def _entries_of_type(references: list[tuple[dict, dict]], ref_type: str) -> list[tuple[dict, dict]]:
    return [item for item in references if item[0]["reference_type"] == ref_type]


def test_pilot_session_activation_via_api_key(tmp_path):
    layer = PilotAccessLayer()
    partner = layer.register_partner(
        "assemble-ai",
        api_keys=["asm-secret"],
        wallet_addresses=["0xabc"],
        default_watermark=True,
    )
    token = layer.issue_protocol_key(
        partner.partner_id,
        max_uses=2,
        metadata={"protocols": ["ASM", "Base"]},
    )
    session = layer.activate_session(
        partner.partner_id,
        protocol_key=token,
        api_key="asm-secret",
        protocols=["ASM", "Base"],
        simulate_real_user_load=True,
        load_multiplier=1.5,
        load_profile={"cohort": "beta"},
    )
    session.toggle_real_user_load(True, load_multiplier=2.5, profile={"region": "global"})
    result = session.simulate_yield(wallet_id="0xabc", strategy_id="demo-strategy", sample_size=25)
    session.log_behavior(wallet_id="0xabc", event_type="test", payload={"result": "ok"})
    session.register_stake(12.5, asset="VF-PILOT", metadata={"lock": "90d"})
    session.trigger_loyalty("activation", score=0.95, metadata={"tier": "gold"})
    session.mirror_consent("consent-123", target_protocol="ASM", metadata={"audited": True})
    session.submit_feedback(feedback_type="bug", message="Found edge case")

    assert session.pilot_mode is True
    assert session.get_watermark() == "Pilot Powered by Vaultfire"
    assert result.partner_tag == partner.anonymized_tag
    assert result.wallet_fingerprint != "0xabc"
    assert session.real_load_enabled is True
    assert session.protocols == ("ASM", "Base")

    references = _load_references()
    reference_types = {entry["reference_type"] for entry, _ in references}
    expected_types = {"session", "yield", "behavior", "feedback", "load-toggle", "stake", "loyalty", "consent"}
    assert expected_types.issubset(reference_types)

    for entry, payload in references:
        assert entry["partner_tag"] == partner.anonymized_tag
        assert "partner_id" not in entry["metadata"]

    session_entry = _entries_of_type(references, "session")[0]
    session_payload = session_entry[1]
    assert session_payload["protocols"] == ["ASM", "Base"]

    yield_entry = _entries_of_type(references, "yield")[0]
    yield_payload = yield_entry[1]
    assert yield_payload["sample_size"] == 62  # 25 * 2.5 load multiplier
    assert "wallet_fingerprint" in yield_payload and "0xabc" not in yield_payload["wallet_fingerprint"]
    assert yield_entry[0]["metadata"]["load_simulation_enabled"] is True

    behavior_entry = _entries_of_type(references, "behavior")[0]
    assert behavior_entry[0]["metadata"]["event_type"] == "test"

    feedback_entry = _entries_of_type(references, "feedback")[0]
    assert "partner_id" not in feedback_entry[1]
    assert feedback_entry[0]["metadata"]["expose_identity"] is False

    load_entries = _entries_of_type(references, "load-toggle")
    assert len(load_entries) == 2
    assert load_entries[-1][1]["load_multiplier"] == 2.5
    assert load_entries[-1][1]["profile"]["region"] == "global"

    stake_entry = _entries_of_type(references, "stake")[0]
    assert stake_entry[1]["amount"] == 12.5
    assert stake_entry[1]["asset"] == "VF-PILOT"

    loyalty_entry = _entries_of_type(references, "loyalty")[0]
    assert loyalty_entry[1]["trigger"] == "activation"
    assert loyalty_entry[1]["score"] == 0.95

    consent_entry = _entries_of_type(references, "consent")[0]
    assert consent_entry[1]["consent_reference"] == "consent-123"
    assert consent_entry[1]["target_protocol"] == "ASM"

    assert not pilot_storage.SESSION_LOG_PATH.exists()
    assert not pilot_storage.YIELD_LOG_PATH.exists()
    assert not pilot_storage.BEHAVIOR_LOG_PATH.exists()
    assert not pilot_storage.FEEDBACK_LOG_PATH.exists()


def test_wallet_signature_activation_and_feedback_identity(tmp_path):
    layer = PilotAccessLayer()
    partner = layer.register_partner(
        "protocol-x",
        wallet_addresses=["0x1234"],
        default_watermark=False,
        allow_identity_disclosure=True,
    )
    secret = layer.registry.get_record(partner.partner_id).signature_secret
    signature_message = "vaultfire-pilot-access"
    signature = hmac.new(
        key=secret.encode("utf-8"),
        msg=f"{partner.wallet_addresses[0]}:{signature_message}".encode("utf-8"),
        digestmod=hashlib.sha256,
    ).hexdigest()
    token = layer.issue_protocol_key(partner.partner_id, expires_in_days=90, max_uses=1, watermark_enabled=False)
    session = layer.activate_session(
        partner.partner_id,
        protocol_key=token,
        wallet_address="0x1234",
        wallet_signature=signature,
        signature_message=signature_message,
        protocols=["Base"],
    )
    assert session.pilot_mode is True
    assert session.get_watermark() is None

    session.submit_feedback(
        feedback_type="feature",
        message="Request new metric",
        severity="high",
        metadata={"priority": "p0"},
        expose_identity=True,
    )
    feedback_entries = _entries_of_type(_load_references(), "feedback")
    assert feedback_entries[-1][0]["metadata"]["expose_identity"] is True
    assert feedback_entries[-1][1]["partner_id"] == partner.partner_id

    with pytest.raises(PermissionError):
        layer.activate_session(
            partner.partner_id,
            protocol_key=token,
            wallet_address="0x1234",
            wallet_signature=signature,
            signature_message=signature_message,
        )
