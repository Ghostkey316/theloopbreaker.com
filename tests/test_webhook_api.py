import pytest
try:
    import flask
except Exception:
    pytest.skip("flask not installed", allow_module_level=True)

import json
import base64
import hmac
import hashlib
from datetime import datetime, timedelta

from vaultfire_webhook import app, SECRET_KEY

client = app.test_client()


def _sign(body: dict) -> str:
    raw = json.dumps(body, sort_keys=False).encode()
    return hmac.new(SECRET_KEY, raw, hashlib.sha256).hexdigest()


def test_webhook_valid_upload(tmp_path):
    ts = datetime.utcnow().isoformat()
    meta = {
        "wallet_id": "0xABCDEF",
        "vaultfire_tier": "Spark",
        "belief_score": 10,
        "timestamp": ts,
        "trigger_id": "t1",
    }
    body = {
        "metadata": meta,
        "payload": base64.b64encode(b"NOPII").decode(),
        "iv": "000000000000000000000000",
    }
    sig = _sign(body)
    resp = client.post("/webhook/upload", json=body, headers={"X-Signature": sig})
    assert resp.status_code == 200
    data = resp.get_json()
    assert "upload_uuid" in data


def test_webhook_requires_signature():
    body = {"metadata": {}, "payload": base64.b64encode(b"NOP").decode()}
    resp = client.post("/webhook/upload", json=body)
    assert resp.status_code == 401
    assert resp.get_json()["error"] == "invalid signature"


def test_webhook_timestamp_drift():
    ts = (datetime.utcnow() + timedelta(seconds=1)).isoformat()
    meta = {
        "wallet_id": "0xABCDEF",
        "vaultfire_tier": "Spark",
        "belief_score": 10,
        "timestamp": ts,
        "trigger_id": "t1",
    }
    body = {
        "metadata": meta,
        "payload": base64.b64encode(b"NOPII").decode(),
        "iv": "000000000000000000000000",
    }
    sig = _sign(body)
    resp = client.post("/webhook/upload", json=body, headers={"X-Signature": sig})
    assert resp.status_code == 400
