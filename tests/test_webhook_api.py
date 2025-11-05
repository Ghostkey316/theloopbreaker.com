import pytest
import pytest

try:  # pragma: no cover - optional dependency powering secure webhook flows
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM  # type: ignore  # noqa: F401
    from cryptography.exceptions import InvalidTag  # type: ignore  # noqa: F401
except (ImportError, ModuleNotFoundError):  # pragma: no cover - skip module when unavailable
    CRYPTOGRAPHY_AVAILABLE = False
else:  # pragma: no cover - executed when dependency present
    CRYPTOGRAPHY_AVAILABLE = True


pytestmark = pytest.mark.skipif(
    not CRYPTOGRAPHY_AVAILABLE,
    reason="[optional] cryptography is required for webhook API tests",
)

try:
    import flask
except Exception:
    pytest.skip("flask not installed", allow_module_level=True)

import json
import base64
import hmac
import hashlib
from datetime import datetime, timedelta

if CRYPTOGRAPHY_AVAILABLE:
    from vaultfire_webhook import app, SECRET_KEY
    client = app.test_client()
else:  # pragma: no cover - placeholders when dependency missing
    app = None  # type: ignore[assignment]
    SECRET_KEY = b""  # type: ignore[assignment]
    client = None  # type: ignore[assignment]


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
