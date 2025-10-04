"""Tests for the Vaultfire pilot mode namespace."""

from __future__ import annotations

import hmac
import hashlib
import json
from pathlib import Path

import pytest

from vaultfire.pilot_mode import PilotAccessLayer
from vaultfire.pilot_mode import storage as pilot_storage


@pytest.fixture(autouse=True)
def isolated_pilot_storage(tmp_path, monkeypatch):
    """Isolate pilot mode storage to a temporary directory for tests."""

    monkeypatch.setattr(pilot_storage, "PILOT_MODE_ROOT", tmp_path)
    monkeypatch.setattr(pilot_storage, "PARTNER_REGISTRY_PATH", tmp_path / "partners.json")
    monkeypatch.setattr(pilot_storage, "PROTOCOL_KEYS_PATH", tmp_path / "protocol_keys.json")
    monkeypatch.setattr(pilot_storage, "SESSION_LOG_PATH", tmp_path / "sessions.jsonl")
    monkeypatch.setattr(pilot_storage, "YIELD_LOG_PATH", tmp_path / "yield.jsonl")
    monkeypatch.setattr(pilot_storage, "BEHAVIOR_LOG_PATH", tmp_path / "behavior.jsonl")
    monkeypatch.setattr(pilot_storage, "FEEDBACK_LOG_PATH", tmp_path / "feedback.jsonl")
    yield


def _read_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def test_pilot_session_activation_via_api_key(tmp_path):
    layer = PilotAccessLayer()
    partner = layer.register_partner(
        "assemble-ai",
        api_keys=["asm-secret"],
        wallet_addresses=["0xabc"],
        default_watermark=True,
    )
    token = layer.issue_protocol_key(partner.partner_id, max_uses=2)
    session = layer.activate_session(
        partner.partner_id,
        protocol_key=token,
        api_key="asm-secret",
    )
    result = session.simulate_yield(wallet_id="0xabc", strategy_id="demo-strategy", sample_size=25)
    session.log_behavior(wallet_id="0xabc", event_type="test", payload={"result": "ok"})
    session.submit_feedback(feedback_type="bug", message="Found edge case")

    assert session.pilot_mode is True
    assert session.get_watermark() == "Pilot Powered by Vaultfire"
    assert result.partner_tag == partner.anonymized_tag
    assert result.wallet_fingerprint != "0xabc"

    sessions = _read_jsonl(pilot_storage.SESSION_LOG_PATH)
    assert len(sessions) == 1
    yield_logs = _read_jsonl(pilot_storage.YIELD_LOG_PATH)
    assert yield_logs[0]["partner_tag"] == partner.anonymized_tag
    assert "wallet_fingerprint" in yield_logs[0] and "0xabc" not in yield_logs[0]["wallet_fingerprint"]
    behavior_logs = _read_jsonl(pilot_storage.BEHAVIOR_LOG_PATH)
    assert behavior_logs[0]["partner_tag"] == partner.anonymized_tag
    assert behavior_logs[0]["wallet_fingerprint"] != "0xabc"
    feedback_logs = _read_jsonl(pilot_storage.FEEDBACK_LOG_PATH)
    assert "partner_id" not in feedback_logs[0]


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
    feedback_logs = _read_jsonl(pilot_storage.FEEDBACK_LOG_PATH)
    assert feedback_logs[-1]["expose_identity"] is True
    assert feedback_logs[-1]["partner_id"] == partner.partner_id

    with pytest.raises(PermissionError):
        layer.activate_session(
            partner.partner_id,
            protocol_key=token,
            wallet_address="0x1234",
            wallet_signature=signature,
            signature_message=signature_message,
        )
