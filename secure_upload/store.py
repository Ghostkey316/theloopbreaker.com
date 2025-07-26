"""Wrapper around :mod:`vaultfire_securestore` with convenience helpers."""
from pathlib import Path
from vaultfire_securestore import SecureStore

__all__ = ["SecureStore", "create_store"]


def create_store(key: bytes, bucket: str | Path) -> SecureStore:
    """Return a :class:`SecureStore` using ``bucket`` path."""
    return SecureStore(key, Path(bucket))
