"""Adaptive AES-256 encryption layer for Vaultfire components."""

from __future__ import annotations

import base64
import json
import os
import socket
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterable, Mapping, Sequence

from hashlib import pbkdf2_hmac, sha256

try:
    from cryptography.exceptions import InvalidTag
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    _CRYPTO_AVAILABLE = True
except ModuleNotFoundError:  # pragma: no cover
    # In minimal/demo runners we prefer graceful degradation over a hard crash.
    # When cryptography is unavailable, Vaultfire will treat encryption as disabled
    # (see should_encrypt) and will not emit ENC:: tokens.
    AESGCM = None  # type: ignore[assignment]

    class InvalidTag(Exception):
        pass

    _CRYPTO_AVAILABLE = False

from .keyring import KeyManager

CONFIG_PATH = Path(__file__).resolve().parents[1] / "vaultfire.config"
DEFAULT_AUDIT_LOG = Path(__file__).resolve().parents[1] / "audit_logs" / "encryption_audit.log"
PREFIX = "ENC::"
_VERSION = 1
_SALT_LENGTH = 16
_NONCE_LENGTH = 12
_KEY_LENGTH = 32
_ITERATIONS = 390_000
_ENCRYPTION_VERSION = "v2.3"
_AUDITED_COMPONENTS: set[str] = set()
_CONFIG_CACHE: "EncryptionConfig" | None = None
_KEY_MANAGER = KeyManager(salt_length=_SALT_LENGTH)
_KEY_SOURCE_CACHE: Dict[str, str] = {}
_COMPONENT_HINTS: tuple[tuple[str, str], ...] = (
    ("partner-handshake", "partner"),
    ("partner-sync", "partner"),
    ("ns3", "logs"),
    ("sync-log", "logs"),
    ("telemetry", "logs"),
    ("reward", "rewards"),
    ("loyalty", "loyalty"),
    ("identity", "identity"),
)


@dataclass(frozen=True)
class EncryptionConfig:
    """Runtime configuration for the encryption layer."""

    full_encryption_mode: bool = False
    audit_log: Path = DEFAULT_AUDIT_LOG
    passphrase_vault: Path | None = None
    hardware_key_path: Path | None = None
    wallet_address: str = "vaultfire"
    encrypt_logs: bool = True
    encrypt_rewards: bool = True
    encrypt_loyalty: bool = True
    encrypt_partner_sync: bool = True
    encrypt_identity: bool = False
    key_rotation_days: int = 30
    ghostkey_mode: bool = False
    ghostkey_mode_override: bool | None = None
    key_source: str | None = None
    encryption_overrides: Mapping[str, bool] = field(default_factory=dict)


def _load_config() -> EncryptionConfig:
    global _CONFIG_CACHE
    if _CONFIG_CACHE is not None:
        return _CONFIG_CACHE
    defaults: Dict[str, Any] = {
        "full_encryption_mode": False,
        "audit_log": str(DEFAULT_AUDIT_LOG),
        "passphrase_vault": None,
        "hardware_key_path": None,
        "wallet_address": "vaultfire",
        "encrypt_logs": True,
        "encrypt_rewards": True,
        "encrypt_loyalty": True,
        "encrypt_partner_sync": True,
        "encrypt_identity": False,
        "key_rotation_days": 30,
        "ghostkey_mode": False,
        "ghostkey_mode_override": None,
        "key_source": None,
        "encryption_overrides": {},
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
    wallet_address = str(data.get("wallet_address") or "vaultfire")
    try:
        key_rotation_days = int(data.get("key_rotation_days", 30))
    except (TypeError, ValueError):
        key_rotation_days = 30
    overrides_raw = data.get("encryption_overrides") or {}
    overrides: Dict[str, bool] = {}
    if isinstance(overrides_raw, Mapping):
        for key, value in overrides_raw.items():
            if isinstance(key, str):
                overrides[key] = bool(value)
    ghostkey_mode = bool(data.get("ghostkey_mode", False))
    ghostkey_override = data.get("ghostkey_mode_override")
    if isinstance(ghostkey_override, bool):
        ghostkey_mode = ghostkey_override
    elif isinstance(ghostkey_override, str):
        ghostkey_mode = ghostkey_override.strip().lower() in {"1", "true", "yes", "on"}
    key_source = data.get("key_source")
    if isinstance(key_source, str) and not key_source.strip():
        key_source = None
    encrypt_identity = bool(data.get("encrypt_identity", False))
    config = EncryptionConfig(
        full_encryption_mode=bool(data.get("full_encryption_mode", False)),
        audit_log=audit_path,
        passphrase_vault=Path(vault_path).expanduser() if vault_path else None,
        hardware_key_path=Path(hardware_path).expanduser() if hardware_path else None,
        wallet_address=wallet_address,
        encrypt_logs=bool(data.get("encrypt_logs", True)),
        encrypt_rewards=bool(data.get("encrypt_rewards", True)),
        encrypt_loyalty=bool(data.get("encrypt_loyalty", True)),
        encrypt_partner_sync=bool(data.get("encrypt_partner_sync", True)),
        encrypt_identity=encrypt_identity,
        key_rotation_days=key_rotation_days,
        ghostkey_mode=ghostkey_mode,
        ghostkey_mode_override=ghostkey_override if isinstance(ghostkey_override, bool) else None,
        key_source=key_source,
        encryption_overrides=overrides,
    )
    _CONFIG_CACHE = config
    return config


_RUNTIME_INITIALISED = False


def set_runtime_passphrase(passphrase: str | None) -> None:
    """Provide a runtime passphrase override for encryption/decryption."""

    global _RUNTIME_INITIALISED
    secret = passphrase.strip() if passphrase else None
    _KEY_MANAGER.set_runtime_override(secret)
    _RUNTIME_INITIALISED = bool(secret)


def _ensure_runtime_override() -> None:
    global _RUNTIME_INITIALISED
    if _RUNTIME_INITIALISED:
        return
    env = os.getenv("VAULTFIRE_ENCRYPTION_PASSPHRASE")
    if env and env.strip():
        _KEY_MANAGER.set_runtime_override(env.strip())
        _RUNTIME_INITIALISED = True
        return
    config = _load_config()
    vault_override = os.getenv("VAULTFIRE_PASSPHRASE_VAULT")
    candidate = Path(vault_override).expanduser() if vault_override else config.passphrase_vault
    if candidate:
        try:
            secret = Path(candidate).read_text(encoding="utf-8").strip()
            if secret:
                _KEY_MANAGER.set_runtime_override(secret)
                _RUNTIME_INITIALISED = True
                return
        except OSError:
            pass
    _RUNTIME_INITIALISED = True


def _resolve_key(component: str) -> bytes:
    _ensure_runtime_override()
    config = _load_config()
    category = _component_category(component)
    rotation_days = max(int(config.key_rotation_days), 0)
    key, source = _KEY_MANAGER.get_key(
        wallet=config.wallet_address,
        category=category,
        rotation_days=rotation_days,
        iterations=_ITERATIONS,
        key_source_hint=config.key_source,
        hardware_path=config.hardware_key_path,
    )
    _KEY_SOURCE_CACHE[component] = source
    return key


def _legacy_passphrase() -> str | None:
    env = os.getenv("VAULTFIRE_ENCRYPTION_PASSPHRASE")
    if env and env.strip():
        return env.strip()
    config = _load_config()
    vault_override = os.getenv("VAULTFIRE_PASSPHRASE_VAULT")
    candidate = Path(vault_override).expanduser() if vault_override else config.passphrase_vault
    if candidate:
        try:
            secret = Path(candidate).read_text(encoding="utf-8").strip()
            if secret:
                return secret
        except OSError:
            pass
    hardware_override = os.getenv("VAULTFIRE_HARDWARE_KEY_PATH")
    candidate_hw = Path(hardware_override).expanduser() if hardware_override else config.hardware_key_path
    if candidate_hw:
        try:
            secret = Path(candidate_hw).read_text(encoding="utf-8").strip()
            if secret:
                return secret
        except OSError:
            pass
    return None


_LEGACY_ITERATIONS = 210_000


def _derive_legacy_key(component: str, salt: bytes) -> bytes | None:
    passphrase = _legacy_passphrase()
    if not passphrase:
        return None
    salt_material = salt + component.encode("utf-8")
    return pbkdf2_hmac(
        "sha256",
        passphrase.encode("utf-8"),
        salt_material,
        _LEGACY_ITERATIONS,
        dklen=_KEY_LENGTH,
    )


def _component_category(component: str) -> str:
    lowered = component.lower()
    for hint, category in _COMPONENT_HINTS:
        if hint in lowered:
            return category
    return "general"


def should_encrypt(component: str | None) -> bool:
    if not component:
        return False

    # If cryptography isn't installed, we cannot safely encrypt/decrypt.
    # Treat encryption as disabled so demo flows still run.
    if not _CRYPTO_AVAILABLE:
        return False

    config = _load_config()
    overrides = config.encryption_overrides
    if overrides and component in overrides:
        return bool(overrides[component])
    if config.ghostkey_mode or config.full_encryption_mode:
        return True
    category = _component_category(component)
    if category == "logs":
        return bool(config.encrypt_logs)
    if category == "rewards":
        return bool(config.encrypt_rewards)
    if category == "loyalty":
        return bool(config.encrypt_loyalty)
    if category == "partner":
        return bool(config.encrypt_partner_sync)
    if category == "identity":
        return bool(config.encrypt_identity)
    return False


def _hash_value(value: Any) -> str:
    try:
        encoded = json.dumps(value, sort_keys=True, default=str).encode("utf-8")
    except TypeError:
        encoded = repr(value).encode("utf-8")
    return sha256(encoded).hexdigest()


_IDENTITY_KEYS = {
    "wallet",
    "ens",
    "address",
    "email",
    "user",
    "username",
    "identity",
    "name",
}


def _ghostkey_scrub(payload: Mapping[str, Any]) -> Dict[str, Any]:
    sanitized: Dict[str, Any] = {}
    for key, value in payload.items():
        lower = key.lower()
        if lower in _IDENTITY_KEYS:
            # Skip direct identifiers.
            continue
        if "wallet" in lower and "hash" not in lower:
            sanitized.setdefault("wallet_hash", _hash_value(value))
            continue
        if "fingerprint" in lower:
            sanitized[key] = _hash_value(value)
            continue
        if isinstance(value, Mapping):
            sanitized[key] = _ghostkey_scrub(value)
            continue
        sanitized[key] = value
    if "wallet_hash" not in sanitized and "wallet" in payload:
        sanitized["wallet_hash"] = _hash_value(payload["wallet"])
    return sanitized


def _audit(component: str, action: str, success: bool, **extra: Any) -> None:
    config = _load_config()
    payload_hash = extra.pop("payload_hash", None)
    entry = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "component": component,
        "action": action,
        "success": bool(success),
        "mode": "full" if config.full_encryption_mode else "disabled",
        "host": socket.gethostname(),
        "pid": os.getpid(),
        "encryptionVersion": _ENCRYPTION_VERSION,
    }
    if payload_hash:
        entry["payload_hash"] = payload_hash
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
    payload_hash = sha256(serialized).hexdigest()
    salt = os.urandom(_SALT_LENGTH)
    key_material = _resolve_key(component)
    key = pbkdf2_hmac(
        "sha256",
        key_material,
        salt + component.encode("utf-8"),
        _ITERATIONS,
        dklen=_KEY_LENGTH,
    )
    nonce = os.urandom(_NONCE_LENGTH)
    cipher = AESGCM(key)
    ciphertext = cipher.encrypt(nonce, serialized, component.encode("utf-8"))
    token = bytes([_VERSION]) + salt + nonce + ciphertext
    _audit_once(component)
    key_source = _KEY_SOURCE_CACHE.get(component, "vaultfire.local")
    _audit(
        component,
        "encrypt",
        True,
        payload_hash=payload_hash,
        keySource=key_source,
        bytes=len(ciphertext),
    )
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

    if not _CRYPTO_AVAILABLE:
        raise RuntimeError(
            "Encrypted payload encountered but 'cryptography' is not installed. "
            "Install cryptography or disable encryption for this environment."
        )

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
    key_material = _resolve_key(component)
    key = pbkdf2_hmac(
        "sha256",
        key_material,
        salt + component.encode("utf-8"),
        _ITERATIONS,
        dklen=_KEY_LENGTH,
    )
    cipher = AESGCM(key)
    try:
        plaintext = cipher.decrypt(nonce, ciphertext, component.encode("utf-8"))
    except InvalidTag as error:
        legacy_key = _derive_legacy_key(component, salt)
        if legacy_key is None:
            raise error
        cipher = AESGCM(legacy_key)
        plaintext = cipher.decrypt(nonce, ciphertext, component.encode("utf-8"))
    parsed = json.loads(plaintext.decode("utf-8"))
    if not isinstance(parsed, Mapping):
        raise ValueError("Decrypted payload is not a mapping")
    return dict(parsed)


def is_encrypted_mapping(data: Mapping[str, Any]) -> bool:
    return bool(data.get("__vaultfire_encrypted__") and isinstance(data.get("encrypted"), str))


class LegacyDataError(RuntimeError):
    """Raised when legacy payload conversion fails."""


def migrate_legacy_file(
    component: str,
    path: Path,
    *,
    preserve_keys: Sequence[str] | None = None,
) -> bool:
    """Convert plaintext NDJSON files to the encrypted format.

    Returns ``True`` when a conversion occurs. Raises :class:`LegacyDataError`
    and emits a warning banner when a failure is encountered.
    """

    if not path.exists():
        return False
    try:
        raw_lines = path.read_text(encoding="utf-8").splitlines()
    except OSError as exc:
        raise LegacyDataError(f"Unable to read legacy file at {path}") from exc
    updated_lines: list[str] = []
    converted = False
    preserve: Iterable[str] = preserve_keys or ()
    for line in raw_lines:
        stripped = line.strip()
        if not stripped:
            continue
        try:
            parsed = json.loads(stripped)
        except json.JSONDecodeError:
            updated_lines.append(line)
            continue
        if not isinstance(parsed, Mapping):
            updated_lines.append(line)
            continue
        if is_encrypted_mapping(parsed):
            updated_lines.append(json.dumps(parsed, sort_keys=True))
            continue
        try:
            wrapped = wrap_mapping(component, parsed, preserve_keys=preserve)
        except Exception as exc:  # noqa: BLE001 - propagate as legacy error
            warning_path = path.with_suffix(path.suffix + ".legacy-warning")
            try:
                warning_path.write_text(
                    "Legacy Data Unencrypted – Action Required.\n",
                    encoding="utf-8",
                )
            except OSError:
                pass
            raise LegacyDataError(f"Failed to convert legacy entry for {component}") from exc
        updated_lines.append(json.dumps(wrapped, sort_keys=True))
        converted = True
    if not converted:
        return False
    serialized = "\n".join(updated_lines) + "\n"
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    try:
        tmp_path.write_text(serialized, encoding="utf-8")
        tmp_path.replace(path)
    except OSError as exc:
        warning_path = path.with_suffix(path.suffix + ".legacy-warning")
        try:
            warning_path.write_text(
                "Legacy Data Unencrypted – Action Required.\n",
                encoding="utf-8",
            )
        except OSError:
            pass
        raise LegacyDataError(f"Unable to persist migrated data for {component}") from exc
    return True


def wrap_mapping(
    component: str,
    payload: Mapping[str, Any],
    *,
    preserve_keys: Sequence[str] | None = None,
) -> Dict[str, Any]:
    """Wrap *payload* with encryption metadata while preserving selected keys."""

    preserve: Iterable[str] = preserve_keys or ()
    config = _load_config()
    working_payload: Dict[str, Any] = dict(payload)
    if config.ghostkey_mode:
        working_payload = _ghostkey_scrub(working_payload)
    if not should_encrypt(component):
        return dict(working_payload)
    preserved: Dict[str, Any] = {key: working_payload[key] for key in preserve if key in working_payload}
    sensitive = {key: value for key, value in working_payload.items() if key not in preserve}
    token = encrypt_mapping(component, sensitive)
    mode = "full" if (config.full_encryption_mode or config.ghostkey_mode) else "selective"
    key_source = _KEY_SOURCE_CACHE.get(component, "vaultfire.local")
    return {
        **preserved,
        "encryption": {
            "component": component,
            "version": _VERSION,
            "mode": mode,
            "keySource": key_source,
            "vaultfireEncryption": _ENCRYPTION_VERSION,
        },
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
