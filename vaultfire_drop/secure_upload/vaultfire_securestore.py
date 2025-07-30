"""Vaultfire SecureStore v1."""
from __future__ import annotations

import json
import os
import hmac
import hashlib
import subprocess
from typing import Tuple

try:  # optional crypto
    from Crypto.Cipher import AES  # type: ignore
except Exception:  # pragma: no cover - library may be missing
    AES = None  # type: ignore
from datetime import datetime
from pathlib import Path

from geolock_filter import strip_exif
from belief_trigger_engine import log_chain_event, send_to_webhook


class SecureStore:
    """Encrypt and store media with signed metadata."""

    def __init__(self, key: bytes, bucket: Path) -> None:
        if len(key) != 32:
            raise ValueError("Key must be 32 bytes for AES-256")
        self.key = key
        self.bucket = bucket
        bucket.mkdir(exist_ok=True, parents=True)

    def _sign(self, metadata: dict) -> str:
        msg = json.dumps(metadata, sort_keys=True).encode()
        return hmac.new(self.key, msg, hashlib.sha256).hexdigest()

    def encrypt_and_store(
        self,
        file_path: Path,
        wallet: str,
        tier: str,
        score: int,
        *,
        webhook: str | None = None,
        chain_log: bool = False,
    ) -> dict:
        """Sanitize ``file_path`` and store encrypted copy."""
        raw = file_path.read_bytes()
        cleaned = strip_exif(raw)
        content_hash = hashlib.sha256(cleaned).hexdigest()

        iv = os.urandom(12)
        tag: bytes | None = None
        if AES:
            cipher = AES.new(self.key, AES.MODE_GCM, nonce=iv)
            ciphertext, tag = cipher.encrypt_and_digest(cleaned)
            encrypted = iv + ciphertext + tag
        else:  # pragma: no cover - fallback if crypto missing
            result = subprocess.run(
                [
                    "openssl",
                    "enc",
                    "-aes-256-cbc",
                    "-K",
                    self.key.hex(),
                    "-iv",
                    iv.hex(),
                ],
                input=cleaned,
                stdout=subprocess.PIPE,
                check=True,
            )
            encrypted = iv + result.stdout
        cid = hashlib.sha256(encrypted).hexdigest()
        enc_path = self.bucket / f"{cid}.bin"
        enc_path.write_bytes(encrypted)

        timestamp = datetime.utcnow().isoformat()
        metadata = {
            "wallet": wallet,
            "tier": tier,
            "score": score,
            "timestamp": timestamp,
            "content_hash": content_hash,
            "cid": cid,
        }
        if tag:
            metadata["tag"] = tag.hex()
        signature_payload = {
            k: metadata[k]
            for k in ["wallet", "tier", "score", "timestamp", "content_hash", "cid"]
        }
        metadata["signature"] = self._sign(signature_payload)
        (self.bucket / f"{cid}.json").write_text(json.dumps(metadata, indent=2))

        if chain_log:
            log_chain_event(wallet, tier, score, timestamp)
        if webhook:
            send_to_webhook(
                webhook,
                wallet,
                tier,
                score,
                timestamp,
                "secure_upload",
                timestamp if chain_log else None,
            )
        return metadata

    def decrypt(self, cid: str, metadata: dict) -> bytes:
        """Return decrypted bytes if ``metadata`` signature matches."""
        meta = {
            k: metadata[k]
            for k in ["wallet", "tier", "score", "timestamp", "content_hash", "cid"]
        }
        if self._sign(meta) != metadata.get("signature"):
            raise ValueError("Invalid signature")
        data = (self.bucket / f"{cid}.bin").read_bytes()
        iv = data[:12]
        body = data[12:]
        tag_hex = metadata.get("tag")
        if AES and tag_hex:
            tag = bytes.fromhex(tag_hex)
            ciphertext = body[:-16]
            cipher = AES.new(self.key, AES.MODE_GCM, nonce=iv)
            return cipher.decrypt_and_verify(ciphertext, tag)
        else:  # pragma: no cover - fallback
            enc = body
            result = subprocess.run(
                [
                    "openssl",
                    "enc",
                    "-d",
                    "-aes-256-cbc",
                    "-K",
                    self.key.hex(),
                    "-iv",
                    iv.hex(),
                ],
                input=enc,
                stdout=subprocess.PIPE,
                check=True,
            )
            return result.stdout

__all__ = ["SecureStore"]
