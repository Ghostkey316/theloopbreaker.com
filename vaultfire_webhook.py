"""Vaultfire secure upload webhook."""
from __future__ import annotations

import base64
import json
import hmac
import hashlib
import logging
from datetime import datetime, timezone
from uuid import uuid4
from pathlib import Path
from logging.handlers import TimedRotatingFileHandler

from flask import Flask, request, jsonify

from geolock_filter import has_gps_exif
from belief_trigger_engine import CHAIN_LOG_PATH


SECRET_KEY = b"supersecretkey0123456789abcdef"  # 32 bytes for HMAC
SHARED_AES_KEY = b"0" * 32  # placeholder key used for AES decryption

app = Flask(__name__)

# Setup daily rotating audit log
AUDIT_LOG_PATH = Path("secure_upload_audit.log")
_handler = TimedRotatingFileHandler(str(AUDIT_LOG_PATH), when="D", interval=1)
audit_logger = logging.getLogger("vaultfire_webhook")
audit_logger.addHandler(_handler)
audit_logger.setLevel(logging.INFO)


def _append_json(path: Path, entry: dict) -> None:
    if path.exists():
        try:
            data = json.loads(path.read_text())
        except json.JSONDecodeError:
            data = []
    else:
        data = []
    data.append(entry)
    path.write_text(json.dumps(data, indent=2))


def _verify_signature(raw: bytes, signature: str) -> bool:
    expected = hmac.new(SECRET_KEY, raw, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def _decrypt_payload(key: bytes, iv: bytes, ciphertext: bytes, tag: bytes | None) -> bytes:
    """Decrypt AES-GCM payload if Crypto library available.

    Falls back to returning ``ciphertext`` if decryption libraries are missing.
    """
    try:
        from Crypto.Cipher import AES  # type: ignore
    except Exception:  # pragma: no cover - library may be absent
        return ciphertext
    cipher = AES.new(key, AES.MODE_GCM, nonce=iv)
    if tag is not None:
        return cipher.decrypt_and_verify(ciphertext, tag)
    return cipher.decrypt(ciphertext)


@app.post("/webhook/upload")
def webhook_upload():
    raw = request.get_data()
    signature = request.headers.get("X-Signature", "")
    if not _verify_signature(raw, signature):
        return jsonify({"error": "invalid signature"}), 403
    try:
        payload = request.get_json(force=True)
    except Exception:
        return jsonify({"error": "invalid json"}), 400

    meta = payload.get("metadata")
    data_b64 = payload.get("payload")
    iv_hex = payload.get("iv", "")
    tag_hex = payload.get("tag")

    required = ["wallet_id", "vaultfire_tier", "belief_score", "timestamp", "trigger_id"]
    if not isinstance(meta, dict) or list(meta.keys()) != required:
        return jsonify({"error": "invalid metadata"}), 400
    try:
        ts = datetime.fromisoformat(meta["timestamp"])
    except Exception:
        return jsonify({"error": "invalid timestamp"}), 400
    now = datetime.now(timezone.utc)
    if abs((now - ts).total_seconds()) > 0.5:
        return jsonify({"error": "timestamp drift"}), 400

    if not data_b64 or not iv_hex:
        return jsonify({"error": "payload missing"}), 400
    try:
        ciphertext = base64.b64decode(data_b64)
        iv = bytes.fromhex(iv_hex)
        tag = bytes.fromhex(tag_hex) if tag_hex else None
    except Exception:
        return jsonify({"error": "invalid payload encoding"}), 400

    decrypted = _decrypt_payload(SHARED_AES_KEY, iv, ciphertext, tag)
    if has_gps_exif(decrypted):
        return jsonify({"error": "exif present"}), 400

    chain_entry = {
        "wallet": meta["wallet_id"],
        "tier": meta["vaultfire_tier"],
        "score": meta["belief_score"],
        "timestamp": meta["timestamp"],
        "trigger": meta["trigger_id"],
    }
    _append_json(CHAIN_LOG_PATH, chain_entry)

    receipt_ts = datetime.utcnow().isoformat()
    upload_id = str(uuid4())
    audit_logger.info(json.dumps({"uuid": upload_id, "received": receipt_ts, **chain_entry}))
    receipt_sig = hmac.new(SECRET_KEY, upload_id.encode(), hashlib.sha256).hexdigest()
    return (
        jsonify(
            {
                "upload_uuid": upload_id,
                "timestamp": receipt_ts,
                "chain_tx": chain_entry,
                "signature": receipt_sig,
            }
        ),
        200,
    )


__all__ = ["app"]
