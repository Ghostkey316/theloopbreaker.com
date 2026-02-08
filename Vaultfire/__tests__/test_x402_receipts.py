from __future__ import annotations

import time

from Vaultfire.x402_receipts import verify_hmac_receipt


def test_verify_hmac_receipt_ok() -> None:
    secret = "unit-test-secret"
    payload = {
        "rail": "assemble",
        "currency": "ASM",
        "amount": 0.00021,
        "wallet_address": "bpow20.cb.id",
        "tx_ref": "abc123",
        "timestamp": int(time.time()),
        "nonce": "n1",
    }

    # compute signature the same way as the verifier does
    from Vaultfire.x402_receipts import _canonical_receipt_message, _hmac_digest

    payload["signature"] = _hmac_digest(_canonical_receipt_message(payload), secret)

    verdict = verify_hmac_receipt(payload, secret=secret, max_skew_seconds=60, nonce_ttl_seconds=60)
    assert verdict.ok


def test_verify_hmac_receipt_replay_fails(tmp_path, monkeypatch) -> None:
    # isolate nonce db
    from Vaultfire import x402_receipts

    monkeypatch.setattr(x402_receipts, "NONCE_STATE_PATH", tmp_path / "nonce_state.json")

    secret = "unit-test-secret"
    base = {
        "rail": "ns3",
        "currency": "ASM",
        "amount": 1.0,
        "wallet_address": "w1",
        "tx_ref": "t1",
        "timestamp": int(time.time()),
        "nonce": "same",
    }

    payload1 = dict(base)
    payload2 = dict(base)

    payload1["signature"] = x402_receipts._hmac_digest(x402_receipts._canonical_receipt_message(payload1), secret)
    payload2["signature"] = x402_receipts._hmac_digest(x402_receipts._canonical_receipt_message(payload2), secret)

    ok1 = verify_hmac_receipt(payload1, secret=secret, max_skew_seconds=60, nonce_ttl_seconds=60)
    assert ok1.ok

    ok2 = verify_hmac_receipt(payload2, secret=secret, max_skew_seconds=60, nonce_ttl_seconds=60)
    assert not ok2.ok
    assert ok2.reason == "replayed nonce"
