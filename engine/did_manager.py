"""Simple DID manager using W3C-style documents.

This module generates basic decentralized identity (DID) documents using a
lightweight ``did:vault`` method. Private keys are encrypted using the
``health_sync_engine`` helpers so identities remain portable and recoverable.
Optional biometric hashes can be stored for vault-grade access control.
"""
from __future__ import annotations

import json
import secrets
import hashlib
from pathlib import Path
from typing import Optional, Dict

from .health_sync_engine import encrypt_data, decrypt_data

BASE_DIR = Path(__file__).resolve().parents[1]
DID_DIR = BASE_DIR / "logs" / "dids"


def _load_json(path: Path, default):
    if path.exists():
        try:
            with open(path) as f:
                return json.load(f)
        except json.JSONDecodeError:
            return default
    return default


def _write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def _hash_id(identifier: str) -> str:
    return hashlib.sha256(identifier.encode()).hexdigest()


# ---------------------------------------------------------------------------

def create_did(user_id: str, key: str, biometric_data: Optional[str] = None) -> str:
    """Create and store a basic DID document for ``user_id``."""
    hashed = _hash_id(user_id)
    did = f"did:vault:{hashed}"
    path = DID_DIR / f"{hashed}_did.json"

    public_key = secrets.token_hex(32)
    private_key = secrets.token_hex(32)

    document: Dict[str, object] = {
        "@context": "https://www.w3.org/ns/did/v1",
        "id": did,
        "publicKey": [{
            "id": f"{did}#key-1",
            "type": "Ed25519VerificationKey2018",
            "controller": did,
            "publicKeyHex": public_key,
        }],
        "authentication": [f"{did}#key-1"],
    }
    if biometric_data:
        document["biometric_hash"] = _hash_id(biometric_data)

    token = encrypt_data(private_key, key)
    _write_json(path, {"document": document, "private_key": token})
    return did


def load_did(user_id: str, key: str) -> Optional[Dict[str, object]]:
    """Load the DID document for ``user_id`` if available."""
    hashed = _hash_id(user_id)
    path = DID_DIR / f"{hashed}_did.json"
    data = _load_json(path, {})
    if not data:
        return None
    document = data.get("document")
    token = data.get("private_key")
    private: Optional[str] = None
    if token:
        try:
            private = decrypt_data(token, key)
        except Exception:
            private = None
    return {"document": document, "private_key": private}


def verify_biometric(user_id: str, biometric_data: str, key: str) -> bool:
    """Return ``True`` if ``biometric_data`` matches stored hash."""
    info = load_did(user_id, key)
    if not info:
        return False
    document = info.get("document") or {}
    stored = document.get("biometric_hash")
    return stored == _hash_id(biometric_data)


__all__ = [
    "create_did",
    "load_did",
    "verify_biometric",
]


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="DID manager")
    parser.add_argument("--user", required=True)
    parser.add_argument("--key", required=True)
    parser.add_argument("--create", action="store_true", help="create DID")
    parser.add_argument("--biometric")
    parser.add_argument("--show", action="store_true", help="show DID info")
    args = parser.parse_args()

    if args.create:
        did = create_did(args.user, args.key, args.biometric)
        print(json.dumps({"did": did}, indent=2))
    elif args.show:
        info = load_did(args.user, args.key)
        print(json.dumps(info, indent=2))

