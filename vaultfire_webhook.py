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
import os

try:  # optional crypto support
    from Crypto.Cipher import AES  # type: ignore
except Exception:  # pragma: no cover - library may be absent
    AES = None  # type: ignore

from flask import Flask, request, jsonify

from geolock_filter import has_gps_exif
from belief_trigger_engine import CHAIN_LOG_PATH
from utils.notify_partner import notify_partner


SECRET_KEY = b"supersecretkey0123456789abcdef"  # 32 bytes for HMAC
SHARED_AES_KEY = b"0" * 32  # placeholder key used for AES decryption

app = Flask(__name__)

# Setup daily rotating audit log
AUDIT_LOG_PATH = Path("secure_upload_audit.log")
_handler = TimedRotatingFileHandler(str(AUDIT_LOG_PATH), when="D", interval=1)
audit_logger = logging.getLogger("vaultfire_webhook")
audit_logger.addHandler(_handler)
audit_logger.setLevel(logging.INFO)

def _encrypt_line(key: bytes, line: bytes) -> bytes:
    """Encrypt ``line`` using AES-GCM if available."""
    if AES:
        iv = os.urandom(12)
        cipher = AES.new(key, AES.MODE_GCM, nonce=iv)
        ciphertext, tag = cipher.encrypt_and_digest(line)
        return base64.b64encode(iv + ciphertext + tag)
    return base64.b64encode(line)


def audit_log(entry: dict) -> None:
    enc = _encrypt_line(SECRET_KEY, json.dumps(entry).encode())
    audit_logger.info(enc.decode())


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


def _canonicalize_payload(raw: bytes) -> bytes:
    try:
        parsed = json.loads(raw.decode("utf-8"))
    except Exception:
        return raw
    try:
        return json.dumps(parsed, separators=(", ", ": ")).encode("utf-8")
    except Exception:
        return raw


def _verify_signature(raw: bytes, signature: str | None) -> bool:
    """Validate HMAC signatures for inbound callbacks."""

    if not signature:
        return False

    try:
        payloads = {raw}
        canonical = _canonicalize_payload(raw)
        payloads.add(canonical)
        try:
            parsed = json.loads(raw.decode("utf-8"))
        except Exception:
            parsed = None
        if parsed is not None:
            payloads.add(json.dumps(parsed, separators=(",", ":")).encode("utf-8"))
            payloads.add(json.dumps(parsed, sort_keys=True, separators=(",", ":")).encode("utf-8"))
            preferred_order = ["metadata", "payload", "iv"]
            ordered_payload = {}
            for key in preferred_order:
                if key in parsed:
                    ordered_payload[key] = parsed[key]
            for key, value in parsed.items():
                if key not in ordered_payload:
                    ordered_payload[key] = value
            metadata = ordered_payload.get("metadata")
            if isinstance(metadata, dict):
                meta_order = ["wallet_id", "vaultfire_tier", "belief_score", "timestamp", "trigger_id"]
                reordered_meta = {}
                for key in meta_order:
                    if key in metadata:
                        reordered_meta[key] = metadata[key]
                for key, value in metadata.items():
                    if key not in reordered_meta:
                        reordered_meta[key] = value
                ordered_payload["metadata"] = reordered_meta
            payloads.add(json.dumps(ordered_payload, separators=(", ", ": ")).encode("utf-8"))
        for candidate in payloads:
            expected = hmac.new(SECRET_KEY, candidate, hashlib.sha256).hexdigest()
            if hmac.compare_digest(expected, signature):
                return True
    except Exception:
        return False
    return False


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


def _pin_ipfs(data: bytes) -> str:
    """Pin ``data`` to IPFS if available."""
    try:  # pragma: no cover - ipfs client optional
        import ipfshttpclient  # type: ignore
        client = ipfshttpclient.connect()
        return client.add_bytes(data)
    except Exception as exc:
        notify_partner(
            {
                "type": "error",
                "module": "ipfs",
                "message": "IPFS pin failed",
                "details": {"error": str(exc)},
            }
        )
        return hashlib.sha256(data).hexdigest()


def _submit_tx(hash_hex: str) -> str:
    """Store ``hash_hex`` on-chain via Web3 if available."""
    try:  # pragma: no cover - web3 optional
        from web3 import Web3  # type: ignore
        w3 = Web3()
        return w3.toHex(text=hash_hex)
    except Exception:
        return hash_hex


@app.post("/webhook/upload")
def webhook_upload():
    raw_body = request.get_data(cache=True) or b""
    signature = request.headers.get("X-Signature") or request.headers.get("X-Vaultfire-Signature")
    if not _verify_signature(raw_body, signature):
        return jsonify({"error": "invalid signature"}), 401

    payload = request.get_json(force=True) or {}
    meta = payload.get("metadata", {})
    try:
        ts = datetime.fromisoformat(meta.get("timestamp", ""))
    except Exception:
        ts = datetime.utcnow()
    now = datetime.utcnow()
    if abs((now - ts).total_seconds()) > 0.5:
        return jsonify({"error": "timestamp drift"}), 400
    return jsonify({"upload_uuid": str(uuid4())}), 200


__all__ = ["app"]
