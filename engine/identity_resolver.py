# Reference: ethics/core.mdx
"""Resolve identities for ENS and Coinbase Wallet IDs."""

from functools import lru_cache
from typing import Optional

ENS_MAP = {
    "ghostkey316.eth": "0x9abCDEF1234567890abcdefABCDEF1234567890",
}

CB_ID_MAP = {
    "bpow20.cb.id": "cb1qexampleaddress0000000000000000000000",
}


@lru_cache(maxsize=32)
def resolve_ens(name: str) -> Optional[str]:
    """Return address for ``name`` if known."""
    return ENS_MAP.get(name.lower())


@lru_cache(maxsize=32)
def resolve_cb_id(name: str) -> Optional[str]:
    """Return address for ``name`` if known."""
    return CB_ID_MAP.get(name.lower())


def resolve_identity(identifier: str) -> Optional[str]:
    """Resolve ``identifier`` to a wallet address."""
    if identifier.endswith(".eth"):
        return resolve_ens(identifier)
    if identifier.endswith(".cb.id"):
        return resolve_cb_id(identifier)
    return None
