"""GhostSeal protocol for encrypting SoulPrint and VoiceSync data."""

from __future__ import annotations

import base64
import hashlib
import json
from typing import Mapping

IDENTITY_HANDLE = "bpow20.cb.id"


class GhostSealProtocol:
    """Encrypt data with optional stealth mirror logic."""

    def __init__(self, *, secret: bytes | str | None = None, identity_handle: str = IDENTITY_HANDLE) -> None:
        self.identity_handle = identity_handle
        self._secret = self._coerce_secret(secret)

    def _coerce_secret(self, secret: bytes | str | None) -> bytes:
        if secret is None:
            return hashlib.sha256(self.identity_handle.encode()).digest()
        if isinstance(secret, str):
            secret = secret.encode()
        if not secret:
            raise ValueError("secret cannot be empty")
        return hashlib.sha256(secret).digest()

    def _derive_key(self, length: int) -> bytes:
        repeated = (self._secret * ((length // len(self._secret)) + 1))[:length]
        return repeated

    def encrypt(self, payload: Mapping[str, object], *, stealth: bool = False) -> str:
        serialized = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
        if stealth:
            serialized = serialized[::-1]
        key_stream = self._derive_key(len(serialized))
        cipher = bytes(b ^ key_stream[i] for i, b in enumerate(serialized))
        return base64.urlsafe_b64encode(cipher).decode()

    def decrypt(self, token: str, *, stealth: bool = False) -> Mapping[str, object]:
        cipher = base64.urlsafe_b64decode(token.encode())
        key_stream = self._derive_key(len(cipher))
        serialized = bytes(b ^ key_stream[i] for i, b in enumerate(cipher))
        if stealth:
            serialized = serialized[::-1]
        return json.loads(serialized.decode())

    def export_bundle(self, payload: Mapping[str, object], *, stealth: bool = False) -> Mapping[str, object]:
        sealed = self.encrypt(payload, stealth=stealth)
        return {
            "identity": self.identity_handle,
            "stealth": stealth,
            "sealed": sealed,
            "cross_chain_ready": True,
        }


__all__ = ["GhostSealProtocol"]
