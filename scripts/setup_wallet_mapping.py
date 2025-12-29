"""
Setup Wallet Mapping for Coinbase IDs

This script maps Coinbase IDs (e.g., bpow20.cb.id) to their actual Base addresses.
"""

import json
from pathlib import Path

CACHE_DIR = Path(__file__).resolve().parents[1] / "cache" / "base_chain"
CACHE_DIR.mkdir(parents=True, exist_ok=True)


def setup_wallet_mapping(cb_id: str, address: str) -> None:
    """Map a Coinbase ID to an Ethereum address."""
    # Validate address format
    if not address.startswith("0x") or len(address) != 42:
        raise ValueError(f"Invalid Ethereum address: {address}")

    # Save mapping
    cache_file = CACHE_DIR / f"{cb_id.replace('.', '_')}_address.json"
    cache_file.write_text(json.dumps({
        "cb_id": cb_id,
        "address": address,
        "network": "base",
        "chain_id": 8453
    }, indent=2))

    print(f"✓ Mapped {cb_id} → {address}")
    print(f"  Saved to: {cache_file}")


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 3:
        print("Usage: python setup_wallet_mapping.py <cb_id> <address>")
        print("Example: python setup_wallet_mapping.py bpow20.cb.id 0x1234...")
        sys.exit(1)

    cb_id = sys.argv[1]
    address = sys.argv[2]

    setup_wallet_mapping(cb_id, address)
