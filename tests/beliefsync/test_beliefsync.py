from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from utils.belief_signer import BeliefSigner
from vaultfire.beliefsync import BeliefSync


def _sample_snapshot(now: datetime) -> dict[str, object]:
    return {
        "validator_id": "validator-123",
        "pop_score": 3.14,
        "amplifier": {"strength": 1.5},
        "drip_history": [
            {"timestamp": (now - timedelta(hours=2)).isoformat(), "value": 10},
            {"timestamp": (now - timedelta(hours=25)).isoformat(), "value": 99},
            {"timestamp": (now - timedelta(hours=6)).isoformat(), "value": 5},
        ],
        "loop_history": [
            {"state": "loop-0"},
            {"state": "loop-1"},
            {"state": "loop-2"},
            {"state": "loop-3"},
            {"state": "loop-4"},
            {"state": "loop-5"},
            {"state": "loop-6"},
            {"state": "loop-7"},
        ],
    }


def test_snapshot_transform_includes_belief_fields():
    now = datetime(2024, 1, 1, 12, 0, tzinfo=timezone.utc)
    signer = BeliefSigner("secret")
    syncer = BeliefSync(signer, clock=lambda: now)

    payload = syncer.sync_from_vaultloop(_sample_snapshot(now))

    assert payload["validator_id"] == "validator-123"
    assert payload["PoP_score"] == pytest.approx(3.14)
    assert payload["amplifier_strength"] == pytest.approx(1.5)
    assert payload["drip_delta"] == pytest.approx(15)
    assert payload["timestamp"] == now.isoformat()
    assert len(payload["loop_recall_vector"]) == 64
    assert "nonce" in payload
    assert payload["nonce"]  # Nonce should be non-empty


def test_valid_sync_structure_and_hashing():
    now = datetime(2024, 5, 4, 0, 0, tzinfo=timezone.utc)
    syncer = BeliefSync(BeliefSigner("secret"), clock=lambda: now)
    snapshot = _sample_snapshot(now)
    payload = syncer.sync_from_vaultloop(snapshot)

    expected_fields = {
        "validator_id",
        "belief_hash",
        "PoP_score",
        "amplifier_strength",
        "timestamp",
        "drip_delta",
        "loop_recall_vector",
        "nonce",
    }
    assert expected_fields.issubset(payload.keys())
    # belief_hash should change if snapshot is altered
    altered = dict(snapshot, pop_score=1)
    assert payload["belief_hash"] != syncer.sync_from_vaultloop(altered)["belief_hash"]


def test_push_to_ns3_posts_signed_payload(monkeypatch):
    now = datetime(2024, 3, 10, 9, 30, tzinfo=timezone.utc)
    signer = BeliefSigner("secret", window_seconds=60)
    syncer = BeliefSync(signer, clock=lambda: now)
    payload = syncer.sync_from_vaultloop(_sample_snapshot(now))

    captured = {}

    def fake_post(url, json=None, timeout=None):  # noqa: A002 - matching httpx signature
        captured["url"] = url
        captured["json"] = json

        class Response:
            status_code = 200

            def raise_for_status(self) -> None:
                return None

            def json(self):
                return {
                    "status": "ok",
                    "receipt": {
                        "payload": payload,
                        "signature": signer.sign(payload, timestamp=now),
                        "timestamp": now.isoformat(),
                    },
                }

        return Response()

    monkeypatch.setattr("vaultfire.beliefsync.httpx.post", fake_post)
    result = syncer.push_to_ns3(payload)

    assert captured["url"] == "https://ns3.local/sync/beliefs"
    assert captured["json"]["signature"]
    assert result.receipt_valid is True
    assert result.response["status"] == "ok"


def test_hmac_verification_blocks_tampering():
    signer = BeliefSigner("super-secret", window_seconds=30)
    payload = {"value": 1}
    ts = datetime(2024, 1, 1, tzinfo=timezone.utc)

    signature = signer.sign(payload, timestamp=ts)
    assert signer.verify(payload, signature, timestamp=ts)
    assert not signer.verify({"value": 2}, signature, timestamp=ts)


def test_receipt_validation_with_tolerance():
    now = datetime(2024, 6, 1, 12, 0, tzinfo=timezone.utc)
    signer = BeliefSigner("receipt-secret", window_seconds=120)
    syncer = BeliefSync(signer, clock=lambda: now)
    payload = syncer.sync_from_vaultloop(_sample_snapshot(now))

    signature = signer.sign(payload, timestamp=now - timedelta(seconds=120))
    receipt = {
        "payload": payload,
        "signature": signature,
        "timestamp": (now - timedelta(seconds=120)).isoformat(),
    }

    assert syncer.validate_receipt(receipt) is True

    tampered = dict(receipt)
    tampered["payload"] = dict(payload, PoP_score=payload["PoP_score"] + 1)
    assert syncer.validate_receipt(tampered) is False


def test_replay_attack_prevention():
    """Test that replay attacks with duplicate nonces are blocked."""
    now = datetime(2024, 7, 1, 12, 0, tzinfo=timezone.utc)
    signer = BeliefSigner("secret", window_seconds=60)
    syncer = BeliefSync(signer, clock=lambda: now)
    payload = syncer.sync_from_vaultloop(_sample_snapshot(now))

    def fake_post(url, json=None, timeout=None):  # noqa: A002
        class Response:
            status_code = 200

            def raise_for_status(self) -> None:
                return None

            def json(self):
                return {"status": "ok", "receipt": None}

        return Response()

    import vaultfire.beliefsync

    original_post = vaultfire.beliefsync.httpx.post
    vaultfire.beliefsync.httpx.post = fake_post

    try:
        # First push should succeed
        result1 = syncer.push_to_ns3(payload)
        assert result1.response["status"] == "ok"
        assert syncer.metrics["syncs_succeeded"] == 1
        assert syncer.metrics["replays_blocked"] == 0

        # Second push with same nonce should fail
        with pytest.raises(ValueError, match="Replay attack detected"):
            syncer.push_to_ns3(payload)

        assert syncer.metrics["replays_blocked"] == 1
    finally:
        vaultfire.beliefsync.httpx.post = original_post


def test_nonce_uniqueness():
    """Test that each sync generates a unique nonce."""
    now = datetime(2024, 8, 1, 12, 0, tzinfo=timezone.utc)
    signer = BeliefSigner("secret")
    syncer = BeliefSync(signer, clock=lambda: now)

    payload1 = syncer.sync_from_vaultloop(_sample_snapshot(now))
    payload2 = syncer.sync_from_vaultloop(_sample_snapshot(now))

    assert payload1["nonce"] != payload2["nonce"]
    assert payload1["nonce"]
    assert payload2["nonce"]
