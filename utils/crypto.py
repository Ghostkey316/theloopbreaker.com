"""High-level cryptography helpers for Vaultfire components."""
from __future__ import annotations

import base64
import hashlib
import os
from dataclasses import dataclass
from typing import Optional

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


_AES_NONCE_SIZE = 12


def derive_key(secret: str, *, length: int = 32) -> bytes:
    """Derive a fixed-length AES key from ``secret``.

    The helper hashes the provided secret to avoid leaking raw passphrases while
    ensuring the returned bytes always match the required AES key sizes. The
    default ``length`` of 32 bytes targets AES-256.
    """
    if not secret:
        raise ValueError("Secret must be a non-empty string")
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    if length not in (16, 24, 32):
        raise ValueError("AES keys must be 16, 24 or 32 bytes long")
    return digest[:length]


@dataclass(frozen=True)
class EncryptedPayload:
    """Bundle returned by :func:`encrypt_bytes`."""

    nonce: bytes
    ciphertext: bytes

    def to_token(self) -> str:
        """Serialize the payload for storage.

        The nonce and ciphertext are concatenated and base64 encoded so callers
        can persist the token as text without worrying about byte handling.
        """
        return base64.urlsafe_b64encode(self.nonce + self.ciphertext).decode("ascii")

    @staticmethod
    def from_token(token: str) -> "EncryptedPayload":
        raw = base64.urlsafe_b64decode(token.encode("ascii"))
        if len(raw) <= _AES_NONCE_SIZE:
            raise ValueError("Encrypted payload is too short")
        nonce = raw[:_AES_NONCE_SIZE]
        ciphertext = raw[_AES_NONCE_SIZE:]
        return EncryptedPayload(nonce=nonce, ciphertext=ciphertext)


def _build_cipher(key: bytes) -> AESGCM:
    if len(key) not in (16, 24, 32):
        raise ValueError("AESGCM keys must be 128, 192, or 256 bits long")
    return AESGCM(key)


def encrypt_bytes(key: bytes, data: bytes, *, associated_data: Optional[bytes] = None) -> EncryptedPayload:
    """Encrypt ``data`` using AES-GCM and return the ciphertext bundle."""
    cipher = _build_cipher(key)
    nonce = os.urandom(_AES_NONCE_SIZE)
    ciphertext = cipher.encrypt(nonce, data, associated_data)
    return EncryptedPayload(nonce=nonce, ciphertext=ciphertext)


def decrypt_bytes(
    key: bytes,
    nonce: bytes,
    ciphertext: bytes,
    *,
    associated_data: Optional[bytes] = None,
) -> bytes:
    """Decrypt AES-GCM data produced by :func:`encrypt_bytes`."""
    cipher = _build_cipher(key)
    return cipher.decrypt(nonce, ciphertext, associated_data)


def encrypt_text(key: bytes, text: str, *, associated_data: Optional[bytes] = None) -> str:
    """Encrypt ``text`` and return a base64 token suitable for storage."""
    payload = encrypt_bytes(key, text.encode("utf-8"), associated_data=associated_data)
    return payload.to_token()


def decrypt_text(key: bytes, token: str, *, associated_data: Optional[bytes] = None) -> str:
    """Inverse of :func:`encrypt_text`."""
    payload = EncryptedPayload.from_token(token)
    data = decrypt_bytes(key, payload.nonce, payload.ciphertext, associated_data=associated_data)
    return data.decode("utf-8")
