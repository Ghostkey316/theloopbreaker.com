"""Key management utilities for Vaultfire encryption."""

from __future__ import annotations

import base64
import json
import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from threading import RLock
from typing import Dict, Tuple

from hashlib import pbkdf2_hmac, sha256

_DEFAULT_ITERATIONS = 390_000
_KEY_LENGTH = 32
_DEFAULT_KEY_SOURCE = "vaultfire.local"
_KEYRING_PATH = Path(__file__).resolve().parents[1] / "secure_storage" / "keyring.json"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _b64encode(value: bytes) -> str:
    return base64.b64encode(value).decode("ascii")


def _b64decode(value: str) -> bytes:
    return base64.b64decode(value.encode("ascii"))


def _wallet_salt(wallet: str, category: str, *, length: int) -> bytes:
    material = f"{wallet or 'vaultfire-anon'}::{category}".encode("utf-8")
    digest = sha256(material).digest()
    if length >= len(digest):
        return digest
    return digest[:length]


def _determine_key_source(config_source: str | None, hardware_path: Path | None) -> str:
    if config_source:
        lowered = config_source.lower()
        if lowered in {"ledger", "trezor"}:
            return "ledger"
        if lowered in {"vaultfire.local", "local", "file"}:
            return _DEFAULT_KEY_SOURCE
    if hardware_path:
        lowered_path = hardware_path.name.lower()
        if "ledger" in lowered_path or "trezor" in lowered_path:
            return "ledger"
    return _DEFAULT_KEY_SOURCE


@dataclass
class _KeyMaterial:
    category: str
    seed: bytes
    salt: bytes
    rotated_at: datetime
    iterations: int


class KeyManager:
    """Persist and rotate symmetric encryption keys."""

    def __init__(self, *, path: Path | None = None, salt_length: int = 16) -> None:
        self._path = path or _KEYRING_PATH
        self._salt_length = salt_length
        self._lock = RLock()
        self._records: Dict[str, _KeyMaterial] = {}
        self._wallet: str = ""
        self._key_source: str = _DEFAULT_KEY_SOURCE
        self._iterations: int = _DEFAULT_ITERATIONS
        self._runtime_override: bytes | None = None
        self._load()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def set_runtime_override(self, secret: str | None) -> None:
        with self._lock:
            self._runtime_override = secret.encode("utf-8") if secret else None

    def get_key(
        self,
        *,
        wallet: str,
        category: str,
        rotation_days: int,
        iterations: int,
        key_source_hint: str | None,
        hardware_path: Path | None,
    ) -> Tuple[bytes, str]:
        """Return a key for *category* and associated key source metadata."""

        with self._lock:
            self._iterations = max(iterations, _DEFAULT_ITERATIONS)
            self._key_source = _determine_key_source(key_source_hint, hardware_path)
            self._wallet = wallet
            if self._runtime_override:
                seed = self._runtime_override
                salt = _wallet_salt(wallet, category, length=self._salt_length)
                key = pbkdf2_hmac(
                    "sha256",
                    seed,
                    salt,
                    self._iterations,
                    dklen=_KEY_LENGTH,
                )
                return key, self._key_source

            if hardware_path and hardware_path.exists():
                try:
                    seed = hardware_path.read_bytes().strip()
                    if not seed:
                        raise ValueError("Hardware key file is empty")
                    salt = _wallet_salt(wallet, category, length=self._salt_length)
                    key = pbkdf2_hmac(
                        "sha256",
                        seed,
                        salt,
                        self._iterations,
                        dklen=_KEY_LENGTH,
                    )
                    return key, self._key_source
                except OSError:
                    # Hardware path unreadable; fall back to stored key material.
                    pass

            record = self._records.get(category)
            now = _utcnow()
            if record is None or (rotation_days > 0 and now - record.rotated_at >= timedelta(days=rotation_days)):
                record = self._generate(category, wallet)
                self._records[category] = record
                self._persist()

            key = pbkdf2_hmac(
                "sha256",
                record.seed,
                record.salt,
                record.iterations,
                dklen=_KEY_LENGTH,
            )
            return key, self._key_source

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _generate(self, category: str, wallet: str) -> _KeyMaterial:
        seed = os.urandom(_KEY_LENGTH)
        salt = _wallet_salt(wallet, category, length=self._salt_length)
        return _KeyMaterial(
            category=category,
            seed=seed,
            salt=salt,
            rotated_at=_utcnow(),
            iterations=self._iterations,
        )

    def _load(self) -> None:
        if not self._path.exists():
            return
        try:
            payload = json.loads(self._path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return
        wallet = payload.get("wallet")
        if isinstance(wallet, str):
            self._wallet = wallet
        key_source = payload.get("keySource")
        if isinstance(key_source, str):
            self._key_source = key_source
        iterations = payload.get("iterations")
        if isinstance(iterations, int) and iterations > 0:
            self._iterations = iterations
        entries = payload.get("keys", {})
        if not isinstance(entries, dict):
            return
        for category, data in entries.items():
            if not isinstance(data, dict):
                continue
            seed_str = data.get("seed")
            salt_str = data.get("salt")
            rotated_at = data.get("rotated_at")
            iterations = data.get("iterations", self._iterations)
            if not (isinstance(seed_str, str) and isinstance(salt_str, str) and isinstance(rotated_at, str)):
                continue
            try:
                record = _KeyMaterial(
                    category=category,
                    seed=_b64decode(seed_str),
                    salt=_b64decode(salt_str),
                    rotated_at=datetime.fromisoformat(rotated_at),
                    iterations=int(iterations),
                )
            except (ValueError, TypeError):
                continue
            self._records[category] = record

    def _persist(self) -> None:
        payload = {
            "wallet": self._wallet,
            "keySource": self._key_source,
            "iterations": self._iterations,
            "keys": {
                category: {
                    "seed": _b64encode(record.seed),
                    "salt": _b64encode(record.salt),
                    "rotated_at": record.rotated_at.isoformat(),
                    "iterations": record.iterations,
                }
                for category, record in self._records.items()
            },
        }
        try:
            self._path.parent.mkdir(parents=True, exist_ok=True)
            tmp_path = self._path.with_suffix(".tmp")
            tmp_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
            tmp_path.replace(self._path)
        except OSError:
            # Non-fatal; key generation will retry on next request.
            pass


__all__ = ["KeyManager"]

