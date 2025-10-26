"""Adaptive AES-256 encryption layer for Vaultfire components."""

from __future__ import annotations

import base64
import json
import os
import socket
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, Mapping, Sequence

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from hashlib import pbkdf2_hmac

CONFIG_PATH = Path(__file__).resolve().parents[1] / "vaultfire.config"
DEFAULT_AUDIT_LOG = Path(__file__).resolve().parents[1] / "audit_logs" / "encryption_audit.log"
PREFIX = "ENC::"
_VERSION = 1
_SALT_LENGTH = 16
_NONCE_LENGTH = 12
_KEY_LENGTH = 32
_ITERATIONS = 210_000
_AUDITED_COMPONENTS: set[str] = set()
_RUNTIME_PASSPHRASE: str | None = None
_CONFIG_CACHE: "EncryptionConfig" | None = None


@dataclass(frozen=True)
class EncryptionConfig:
    """Runtime configuration for the encryption layer."""

    full_encryption_mode: bool = False
    audit_log: Path = DEFAULT_AUDIT_LOG
    passphrase_vault: Path | None = None
    hardware_key_path: Path | None = None


def _load_config() -> EncryptionConfig:
    global _CONFIG_CACHE
    if _CONFIG_CACHE is not None:
        return _CONFIG_CACHE
    defaults: Dict[str, Any] = {
        "full_encryption_mode": False,
        "audit_log": str(DEFAULT_AUDIT_LOG),
        "passphrase_vault": None,
        "hardware_key_path": None,
    }
    data: Dict[str, Any]
    try:
        raw = CONFIG_PATH.read_text(encoding="utf-8")
        parsed = json.loads(raw)
        if not isinstance(parsed, dict):
            parsed = {}
        data = {**defaults, **parsed}
    except FileNotFoundError:
        data = defaults
    except json.JSONDecodeError:
        data = defaults
    audit_path = Path(data.get("audit_log") or DEFAULT_AUDIT_LOG)
    if not audit_path.is_absolute():
        audit_path = CONFIG_PATH.parent / audit_path
    vault_path = data.get("passphrase_vault")
    hardware_path = data.get("hardware_key_path")
    config = EncryptionConfig(
        full_encryption_mode=bool(data.get("full_encryption_mode", False)),
        audit_log=audit_path,
        passphrase_vault=Path(vault_path).expanduser() if vault_path else None,
        hardware_key_path=Path(hardware_path).expanduser() if hardware_path else None,
    )
    _CONFIG_CACHE = config
    return config


def set_runtime_passphrase(passphrase: str | None) -> None:
    """Provide a runtime passphrase override for encryption/decryption."""

    global _RUNTIME_PASSPHRASE
    _RUNTIME_PASSPHRASE = passphrase.strip() if passphrase else None


def _resolve_passphrase() -> str | None:
    if _RUNTIME_PASSPHRASE:
        return _RUNTIME_PASSPHRASE
    env = os.getenv("VAULTFIRE_ENCRYPTION_PASSPHRASE")
    if env and env.strip():
        return env.strip()
    config = _load_config()
    vault_path = os.getenv("VAULTFIRE_PASSPHRASE_VAULT") or (
        str(config.passphrase_vault) if config.passphrase_vault else None
    )
    if vault_path:
        try:
            secret = Path(vault_path).read_text(encoding="utf-8").strip()
            if secret:
                return secret
        except OSError:
            pass
    hardware_path = os.getenv("VAULTFIRE_HARDWARE_KEY_PATH") or (
        str(config.hardware_key_path) if config.hardware_key_path else None
    )
    if hardware_path:
        try:
            secret = Path(hardware_path).read_text(encoding="utf-8").strip()
            if secret:
                return secret
        except OSError:
            pass
    return None


def should_encrypt(component: str | None) -> bool:
    if not component:
        return False
    config = _load_config()
    return bool(config.full_encryption_mode)


def _audit(component: str, action: str, success: bool, **extra: Any) -> None:
    config = _load_config()
    entry = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "component": component,
        "action": action,
        "success": bool(success),
        "mode": "full" if config.full_encryption_mode else "disabled",
        "host": socket.gethostname(),
        "pid": os.getpid(),
    }
    entry.update(extra)
    try:
        config.audit_log.parent.mkdir(parents=True, exist_ok=True)
        with config.audit_log.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(entry, separators=(",", ":")))
            handle.write("\n")
    except OSError:
        pass


def _audit_once(component: str) -> None:
    if component in _AUDITED_COMPONENTS:
        return
    _AUDITED_COMPONENTS.add(component)
    _audit(component, "encrypt-init", True)


def _derive_key(component: str, salt: bytes) -> bytes:
    passphrase = _resolve_passphrase()
    if not passphrase:
        raise RuntimeError(
            "Encryption enabled but no passphrase is available. Set VAULTFIRE_ENCRYPTION_PASSPHRASE."
        )
    salt_material = salt + component.encode("utf-8")
    return pbkdf2_hmac("sha256", passphrase.encode("utf-8"), salt_material, _ITERATIONS, dklen=_KEY_LENGTH)


def _base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _base64url_decode(token: str) -> bytes:
    padding = '=' * (-len(token) % 4)
    return base64.urlsafe_b64decode(token + padding)


def encrypt_mapping(component: str, payload: Mapping[str, Any]) -> str:
    """Encrypt *payload* and return a text token."""

    serialized = json.dumps(payload, sort_keys=True).encode("utf-8")
    if not should_encrypt(component):
        return serialized.decode("utf-8")
    salt = os.urandom(_SALT_LENGTH)
    key = _derive_key(component, salt)
    nonce = os.urandom(_NONCE_LENGTH)
    cipher = AESGCM(key)
    ciphertext = cipher.encrypt(nonce, serialized, component.encode("utf-8"))
    token = bytes([_VERSION]) + salt + nonce + ciphertext
    _audit_once(component)
    _audit(component, "encrypt", True, bytes=len(ciphertext))
    return PREFIX + _base64url_encode(token)


def decrypt_token(component: str, token: str) -> Mapping[str, Any]:
    """Decrypt *token* back into a mapping."""

    if not token:
        return {}
    if not token.startswith(PREFIX):
        try:
            parsed = json.loads(token)
            return parsed if isinstance(parsed, Mapping) else {}
        except json.JSONDecodeError:
            return {}
    raw = _base64url_decode(token[len(PREFIX) :])
    if len(raw) <= 1 + _SALT_LENGTH + _NONCE_LENGTH:
        raise ValueError("Encrypted payload is malformed")
    version = raw[0]
    if version != _VERSION:
        raise ValueError(f"Unsupported encryption version: {version}")
    salt_start = 1
    salt_end = salt_start + _SALT_LENGTH
    nonce_end = salt_end + _NONCE_LENGTH
    salt = raw[salt_start:salt_end]
    nonce = raw[salt_end:nonce_end]
    ciphertext = raw[nonce_end:]
    key = _derive_key(component, salt)
    cipher = AESGCM(key)
    plaintext = cipher.decrypt(nonce, ciphertext, component.encode("utf-8"))
    parsed = json.loads(plaintext.decode("utf-8"))
    if not isinstance(parsed, Mapping):
        raise ValueError("Decrypted payload is not a mapping")
    return dict(parsed)


def is_encrypted_mapping(data: Mapping[str, Any]) -> bool:
    return bool(data.get("__vaultfire_encrypted__") and isinstance(data.get("encrypted"), str))


def wrap_mapping(
    component: str,
    payload: Mapping[str, Any],
    *,
    preserve_keys: Sequence[str] | None = None,
) -> Dict[str, Any]:
    """Wrap *payload* with encryption metadata while preserving selected keys."""

    preserve: Iterable[str] = preserve_keys or ()
    if not should_encrypt(component):
        return dict(payload)
    preserved: Dict[str, Any] = {key: payload[key] for key in preserve if key in payload}
    sensitive = {key: value for key, value in payload.items() if key not in preserve}
    token = encrypt_mapping(component, sensitive)
    return {
        **preserved,
        "encryption": {"component": component, "version": _VERSION, "mode": "full"},
        "__vaultfire_encrypted__": True,
        "encrypted": token,
    }


def decrypt_wrapped_mapping(data: Mapping[str, Any]) -> Dict[str, Any]:
    component = data.get("encryption", {}).get("component") if isinstance(data.get("encryption"), Mapping) else None
    if not component or not data.get("__vaultfire_encrypted__"):
        return dict(data)
    sensitive = decrypt_token(component, data["encrypted"])
    merged = dict(sensitive)
    for key, value in data.items():
        if key in {"__vaultfire_encrypted__", "encrypted", "encryption"}:
            continue
        merged[key] = value
    return merged


def decrypt_mapping_from_file(component: str | None, data: Mapping[str, Any]) -> Dict[str, Any]:
    if is_encrypted_mapping(data):
        inferred = component or data.get("encryption", {}).get("component")
        if not inferred:
            raise ValueError("Encrypted mapping is missing component metadata")
        sensitive = decrypt_token(inferred, data["encrypted"])
        merged = dict(sensitive)
        for key, value in data.items():
            if key in {"__vaultfire_encrypted__", "encrypted", "encryption"}:
                continue
            merged[key] = value
        return merged
    return dict(data)


def decrypt_mapping(data: Mapping[str, Any]) -> Dict[str, Any]:
    """Decrypt an encrypted mapping returned by :func:`wrap_mapping`."""

    return decrypt_wrapped_mapping(data)
