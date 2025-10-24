from __future__ import annotations

from flask import Flask

from vaultfire.x402_gateway import X402Gateway
from vaultfire.x402_listener import x402EventListener


def test_webhook_and_dashboard(tmp_path, monkeypatch):
    gateway = X402Gateway(
        ledger_path=tmp_path / "ledger.jsonl",
        codex_memory_path=tmp_path / "memory.jsonl",
        ghostkey_earnings_path=tmp_path / "ghostkey.jsonl",
        companion_path=tmp_path / "companion.jsonl",
    )
    for _ in range(51):
        gateway.record_external_event(event_type="seed", status="ok")

    state_path = tmp_path / "state.json"
    monkeypatch.setattr("vaultfire.x402_listener._STATE_PATH", state_path, raising=False)
    monkeypatch.setattr("vaultfire.x402_listener.get_default_gateway", lambda: gateway)

    app = Flask(__name__)
    x402EventListener(app)
    client = app.test_client()

    response = client.post(
        "/vaultfire/x402-webhook",
        json={
            "type": "payment",
            "status": "confirmed",
            "amount": 1.5,
            "currency": "ASM",
            "tx_hash": "0xabc",
            "loyalty_score": 0.9,
        },
    )
    assert response.status_code == 200
    data = response.get_json()
    assert data["entry"]["event_type"] == "payment"
    assert "airdrop" in data

    dashboard = client.get("/vaultfire/x402-dashboard")
    assert dashboard.status_code == 200
    payload = dashboard.get_json()
    assert "events" in payload and payload["events"]
    assert payload["count"] >= 52
