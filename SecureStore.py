"""Mobile-aware SecureStore wrapper with optional stub implementation."""
from __future__ import annotations

import json
import hmac
import hashlib
from datetime import datetime
from pathlib import Path

from mobile_mode import MOBILE_MODE

try:
    if not MOBILE_MODE:
        from vaultfire_securestore import SecureStore as SecureStore  # type: ignore
    else:  # pragma: no cover - mobile fallback
        raise ImportError
except Exception:  # pragma: no cover - fallback when full version unavailable
    from geolock_filter import strip_exif
    from belief_trigger_engine import log_chain_event, send_to_webhook
    from utils.crypto import decrypt_bytes, encrypt_bytes

    class SecureStore:
        """Lightweight SecureStore suitable for mobile environments."""

        def __init__(self, key: bytes, bucket: str | Path) -> None:
            if len(key) not in (16, 24, 32):
                raise ValueError("Key must be 16, 24, or 32 bytes for AES-GCM")
            self.key = key
            self.bucket = Path(bucket)
            self.bucket.mkdir(parents=True, exist_ok=True)

        def _sign(self, payload: dict) -> str:
            msg = json.dumps(payload, sort_keys=True).encode()
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
            meta = {
                k: metadata[k]
                for k in ["wallet", "tier", "score", "timestamp", "content_hash", "cid"]
            }
            if self._sign(meta) != metadata.get("signature"):
                raise ValueError("Invalid signature")
            ciphertext = (self.bucket / f"{cid}.bin").read_bytes()
            nonce_hex = metadata.get("nonce")
            if not nonce_hex:
                raise ValueError("Missing nonce in metadata")
            nonce = bytes.fromhex(nonce_hex)
            return decrypt_bytes(self.key, nonce, ciphertext)

    def calculate_signature(key: bytes, payload: dict) -> str:
        """Return signature for ``payload`` using ``key``."""
        msg = json.dumps(payload, sort_keys=True).encode()
        return hmac.new(key, msg, hashlib.sha256).hexdigest()
else:
    def calculate_signature(key: bytes, payload: dict) -> str:
        msg = json.dumps(payload, sort_keys=True).encode()
        return hmac.new(key, msg, hashlib.sha256).hexdigest()

__all__ = ["SecureStore", "calculate_signature"]
