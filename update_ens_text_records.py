"""Update ENS text records for a given name using web3.py."""

from __future__ import annotations

import os
from typing import Dict, Iterable, Optional

from mobile_mode import MOBILE_MODE

if not MOBILE_MODE:
    try:  # optional dependency for desktop mode
        from web3 import Web3  # type: ignore
    except Exception:  # pragma: no cover - missing on mobile
        Web3 = None  # type: ignore
    try:
        from ens import ENS  # type: ignore
    except Exception:  # pragma: no cover - missing on mobile
        ENS = None  # type: ignore
else:  # pragma: no cover - enforced mobile fallback
    Web3 = None  # type: ignore
    ENS = None  # type: ignore

ENS_DISABLED = Web3 is None or ENS is None

if ENS_DISABLED:
    def update_text_records() -> None:
        """Fallback when ENS features are unavailable."""
        print("ENS text record update skipped (mobile mode).")

FIELDS = {
    "vaultfire_sync": "true",
    "loyalty_tier": "Legacy Tier",
    "contributor_id": "Ghostkey-316",
    "status": "Active",
}


def get_web3() -> Web3:
    """Return ``Web3`` instance connected to the provider."""
    provider_uri = os.environ.get("WEB3_PROVIDER_URI", "http://localhost:8545")
    return Web3(Web3.HTTPProvider(provider_uri))


def load_text_records(ns: ENS, name: str, keys: Iterable[str]) -> Dict[str, str | None]:
    """Return current text records for ``name``."""
    records: Dict[str, str | None] = {}
    for key in keys:
        try:
            records[key] = ns.get_text(name, key)
        except Exception:
            records[key] = None
    return records


def diff_records(current: Dict[str, str | None], desired: Dict[str, str]) -> Dict[str, str]:
    """Return subset of ``desired`` that differs from ``current``."""
    mismatched = {}
    for key, value in desired.items():
        if current.get(key) != value:
            mismatched[key] = value
    return mismatched


def update_records(ns: ENS, name: str, updates: Dict[str, str]) -> None:
    """Update ENS text records for ``name`` with ``updates``."""
    for key, value in updates.items():
        tx_hash = ns.set_text(name, key, value)
        ns.w3.eth.wait_for_transaction_receipt(tx_hash)
        print(f"Updated {key} -> {value}")


if not ENS_DISABLED:
    def update_text_records() -> None:
        """Sync ENS text records when dependencies are available."""
        name = os.environ.get("TARGET_ENS", "ghostkey316.eth")
        w3 = get_web3()
        ns = ENS.from_web3(w3)
        current = load_text_records(ns, name, FIELDS.keys())
        mismatched = diff_records(current, FIELDS)
        if not mismatched:
            print("All text records already in sync")
            return
        update_records(ns, name, mismatched)


def main() -> None:
    if ENS_DISABLED:
        raise RuntimeError("ens and web3 packages required for ENS updates")
    update_text_records()


if __name__ == "__main__":
    main()
