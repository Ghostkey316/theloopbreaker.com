"""Mobile-aware SecureStore wrapper with optional stub implementation."""
from __future__ import annotations

import json
import hmac
import hashlib
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from typing import Callable, Iterable, Optional

from mobile_mode import MOBILE_MODE

try:
    if not MOBILE_MODE:
        from vaultfire_securestore import SecureStore as SecureStore  # type: ignore
    else:  # pragma: no cover - mobile fallback
        raise ImportError
except Exception:  # pragma: no cover - fallback when full version unavailable
    from geolock_filter import strip_exif
    from utils.crypto import decrypt_bytes, encrypt_bytes

    def _log_chain_event(*args, **kwargs):
        from belief_trigger_engine import log_chain_event

        return log_chain_event(*args, **kwargs)

    def _send_to_webhook(*args, **kwargs):
        from belief_trigger_engine import send_to_webhook

        return send_to_webhook(*args, **kwargs)

    class SecureStore:
        """Lightweight SecureStore suitable for mobile environments."""

        def __init__(
            self,
            key: bytes,
            bucket: str | Path,
            *,
            max_retries: int = 2,
            retry_backoff: float = 0.05,
            retry_dir: str | Path | None = None,
            intent_logger: Optional[Callable[[dict], None]] = None,
        ) -> None:
            if len(key) not in (16, 24, 32):
                raise ValueError("Key must be 16, 24, or 32 bytes for AES-GCM")
            self.key = key
            self.bucket = Path(bucket)
            self.bucket.mkdir(parents=True, exist_ok=True)
            self.max_retries = max(0, max_retries)
            self.retry_backoff = max(0.0, retry_backoff)
            retry_base = Path(retry_dir) if retry_dir else self.bucket / "retries"
            self.retry_dir = retry_base.resolve()
            self.retry_dir.mkdir(parents=True, exist_ok=True)
            self.intent_logger = intent_logger

        def _sign(self, payload: dict) -> str:
            msg = json.dumps(payload, sort_keys=True).encode()
            return hmac.new(self.key, msg, hashlib.sha256).hexdigest()

        def _record_intent(self, status: str, metadata: dict, *, reason: str | None = None) -> None:
            if not self.intent_logger:
                return
            try:
                self.intent_logger(
                    {
                        "status": status,
                        "reason": reason,
                        "cid": metadata.get("cid"),
                        "wallet": metadata.get("wallet"),
                        "timestamp": datetime.utcnow().isoformat(),
                    }
                )
            except Exception:
                pass

        def _persist_retry_payload(self, metadata: dict, error: Exception) -> Path:
            payload = {
                "metadata": metadata,
                "error": str(error),
                "capturedAt": datetime.utcnow().isoformat(),
            }
            retry_path = self.retry_dir / f"{metadata.get('cid', 'unknown')}.retry.json"
            retry_path.write_text(json.dumps(payload, indent=2))
            return retry_path

        def _attempt_store(self, file_path: Path, wallet: str, tier: str, score: int) -> dict:
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
            return metadata

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
            attempt = 0
            last_error: Exception | None = None
            while attempt <= self.max_retries:
                try:
                    metadata = self._attempt_store(file_path, wallet, tier, score)
                except Exception as error:  # pragma: no cover - guard against unexpected IO errors
                    last_error = error
                    attempt += 1
                    if attempt > self.max_retries:
                        break
                    time.sleep(self.retry_backoff * attempt)
                    continue

                if chain_log:
                    _log_chain_event(wallet, tier, score, metadata["timestamp"])
                if webhook:
                    _send_to_webhook(
                        webhook,
                        wallet,
                        tier,
                        score,
                        metadata["timestamp"],
                        "secure_upload",
                        metadata["timestamp"] if chain_log else None,
                    )
                self._record_intent("stored", metadata)
                return metadata

            assert last_error is not None
            metadata = {
                "wallet": wallet,
                "tier": tier,
                "score": score,
                "timestamp": datetime.utcnow().isoformat(),
                "cid": None,
            }
            self._record_intent("retry-buffered", metadata, reason=str(last_error))
            self._persist_retry_payload(metadata, last_error)
            raise last_error

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

        def validate_pipeline(
            self,
            payloads: Iterable[tuple[Path, str, str, int]],
            *,
            concurrency: int = 4,
        ) -> dict:
            start = time.perf_counter()
            successes = []
            failures = []
            with ThreadPoolExecutor(max_workers=max(1, concurrency)) as executor:
                future_map = {
                    executor.submit(self.encrypt_and_store, path, wallet, tier, score): (path, wallet)
                    for path, wallet, tier, score in payloads
                }
                for future in as_completed(future_map):
                    context = future_map[future]
                    try:
                        successes.append(future.result())
                    except Exception as error:
                        failures.append({"context": context, "error": str(error)})
            duration = time.perf_counter() - start
            throughput = (len(successes) / duration) if duration else 0.0
            return {
                "processed": len(successes),
                "failed": failures,
                "duration": duration,
                "throughput": throughput,
            }

    def calculate_signature(key: bytes, payload: dict) -> str:
        """Return signature for ``payload`` using ``key``."""
        msg = json.dumps(payload, sort_keys=True).encode()
        return hmac.new(key, msg, hashlib.sha256).hexdigest()
else:
    def calculate_signature(key: bytes, payload: dict) -> str:
        msg = json.dumps(payload, sort_keys=True).encode()
        return hmac.new(key, msg, hashlib.sha256).hexdigest()

__all__ = ["SecureStore", "calculate_signature"]
