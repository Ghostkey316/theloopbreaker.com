# Reference: ethics/core.mdx
"""Resolve identities for ENS and Coinbase Wallet IDs."""

from functools import lru_cache
from typing import Optional

ENS_MAP = {
    "ghostkey316.eth": "0x9abCDEF1234567890abcdefABCDEF1234567890",
    "sample.eth": "0x0000000000000000000000000000000000000001",
    "atlantech.eth": "0x1111111111111111111111111111111111111111",
    "luminetwork.eth": "0x2222222222222222222222222222222222222222",
    "ethicallens.eth": "0x3333333333333333333333333333333333333333",
    "civicforge.eth": "0x4444444444444444444444444444444444444444",
    "harmonics.eth": "0x5555555555555555555555555555555555555555",
}

CB_ID_MAP = {
    "bpow20.cb.id": "cb1qexampleaddress0000000000000000000000",
    "atlantech.cb.id": "cb1qatlantech0000000000000000000000000",
    "luminetwork.cb.id": "cb1qluminetwork00000000000000000000000",
    "ethicallens.cb.id": "cb1qethicallens0000000000000000000000",
    "civicforge.cb.id": "cb1qcivicforge00000000000000000000000",
    "harmonics.cb.id": "cb1qharmonics000000000000000000000000",
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
    ident = identifier.lower()
    if ident.startswith("0x") and len(ident) == 42:
        return ident
    if ident.endswith(".eth"):
        addr = resolve_ens(ident)
        if addr is None and ident == "ghostkey316.eth":
            return resolve_cb_id("bpow20.cb.id")
        return addr
    if ident.endswith(".cb.id"):
        return resolve_cb_id(ident)
    return None
