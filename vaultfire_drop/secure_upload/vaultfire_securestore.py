"""Vaultfire SecureStore v1."""
from __future__ import annotations

import json
import hmac
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Optional

from geolock_filter import strip_exif
from belief_trigger_engine import log_chain_event, send_to_webhook
from utils.crypto import decrypt_bytes, encrypt_bytes


class SecureStore:
    """Encrypt and store media with signed metadata."""

    def __init__(self, key: bytes, bucket: Path) -> None:
        if len(key) not in (16, 24, 32):
            raise ValueError("Key must be 16, 24, or 32 bytes for AES-GCM")
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
        webhook: Optional[str] = None,
        chain_log: bool = False,
    ) -> dict:
        """Sanitize ``file_path`` and store encrypted copy."""
        raw = file_path.read_bytes()
        cleaned = strip_exif(raw)
        content_hash = hashlib.sha256(cleaned).hexdigest()

        payload = encrypt_bytes(self.key, cleaned)
        ciphertext = payload.ciphertext
        cid = hashlib.sha256(payload.nonce + ciphertext).hexdigest()
        enc_path = self.bucket / f"{cid}.bin"
        enc_path.write_bytes(ciphertext)

        timestamp = datetime.utcnow().isoformat()
        metadata = {
            "wallet": wallet,
            "tier": tier,
            "score": score,
            "timestamp": timestamp,
            "content_hash": content_hash,
            "cid": cid,
            "nonce": payload.nonce.hex(),
        }
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
        data_path = self.bucket / f"{cid}.bin"
        ciphertext = data_path.read_bytes()
        nonce_hex = metadata.get("nonce")
        if not nonce_hex:
            raise ValueError("Missing nonce in metadata")
        nonce = bytes.fromhex(nonce_hex)
        return decrypt_bytes(self.key, nonce, ciphertext)


__all__ = ["SecureStore"]
