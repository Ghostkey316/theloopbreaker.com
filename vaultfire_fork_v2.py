"""Vaultfire Fork V2 utility."""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import secrets
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Dict, Any

BASE_DIR = Path(__file__).resolve().parent
PURPOSE_MAP_PATH = BASE_DIR / "purpose_map.json"
PARTNERS_PATH = BASE_DIR / "partners.json"
LOG_PATH = BASE_DIR / "partner_registry.log"

TRAIT_TIERS: Dict[str, list[str]] = {
    "basic": ["access-lite", "limited-yield"],
    "plus": ["access-standard", "yield-bonus"],
    "premium": ["access-pro", "yield-max"],
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

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


# lightweight XOR encryption -----------------------------------------------

def _xor_cipher(data: bytes, key: str) -> bytes:
    key_bytes = key.encode()
    return bytes(b ^ key_bytes[i % len(key_bytes)] for i, b in enumerate(data))


def encrypt_data(data: bytes, key: str) -> str:
    cipher = _xor_cipher(data, key)
    return base64.urlsafe_b64encode(cipher).decode()


# ---------------------------------------------------------------------------


def _log(entry: Dict[str, Any]) -> None:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    with open(LOG_PATH, "a") as f:
        f.write(json.dumps({"timestamp": timestamp, **entry}) + "\n")


# ---------------------------------------------------------------------------
# Core logic
# ---------------------------------------------------------------------------

def generate_bundle(args: argparse.Namespace) -> dict:
    src_path = Path(args.source_protocol)
    partner_key = secrets.token_hex(16)
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

    fork = {
        "source": src_path.name,
        "partner_wallet": args.partner_wallet,
        "ethics_locked": bool(args.ethics_locked),
        "yield_profile": args.yield_profile,
        "loyalty_engine": args.loyalty_engine,
        "token_gate": None,
        "expiration_days": args.expiration,
        "timestamp": timestamp,
    }
    if args.token_gate:
        fork["token_gate"] = {"contract": args.token_gate[0], "id": args.token_gate[1]}

    traits = TRAIT_TIERS.get(args.yield_profile, [])
    trait_map = {"wallet": args.partner_wallet, "traits": traits}

    manifest_link = None
    manifest_text = None
    if args.manifesto:
        manifest_text = (
            f"# Manifesto\n\nPartner: {args.partner_wallet}\n"
            f"Yield Profile: {args.yield_profile}\n"
            f"Ethics Locked: {args.ethics_locked}\n"
        )
        manifest_hash = hashlib.sha256(manifest_text.encode()).hexdigest()
        manifest_link = f"https://manifesto.vaultfire/edit/{manifest_hash}"

    # build zip
    with tempfile.TemporaryDirectory() as tmpdir:
        td = Path(tmpdir)
        (td / "protocol.json").write_text(json.dumps(fork, indent=2))
        (td / "trait_map.json").write_text(json.dumps(trait_map, indent=2))
        if manifest_text:
            (td / "manifesto.md").write_text(manifest_text)
        zip_bytes = tempfile.NamedTemporaryFile(delete=False)
        with zipfile.ZipFile(zip_bytes, "w") as zf:
            zf.write(td / "protocol.json", "protocol.json")
            zf.write(td / "trait_map.json", "trait_map.json")
            if manifest_text:
                zf.write(td / "manifesto.md", "manifesto.md")
        zip_bytes.close()
        raw = Path(zip_bytes.name).read_bytes()
        enc = encrypt_data(base64.b64encode(raw), partner_key)

    vault_name = f"{args.partner_wallet.replace('.', '_')}_fork.vault"
    vault_path = BASE_DIR / vault_name
    vault_path.write_text(enc)

    trait_path = BASE_DIR / f"{args.partner_wallet.replace('.', '_')}_traits.json"
    _write_json(trait_path, trait_map)

    if manifest_text:
        manifest_path = BASE_DIR / f"{args.partner_wallet.replace('.', '_')}_manifesto.md"
        manifest_path.write_text(manifest_text)
    else:
        manifest_path = None

    conf_hash = hashlib.sha256(enc.encode()).hexdigest()

    # register entries
    purpose = _load_json(PURPOSE_MAP_PATH, {"records": []})
    if isinstance(purpose, list):
        # legacy list format
        purpose.append({"wallet": args.partner_wallet, "bundle": vault_name, "hash": conf_hash})
    else:
        purpose.setdefault("records", []).append({
            "wallet": args.partner_wallet,
            "bundle": vault_name,
            "hash": conf_hash,
        })
    _write_json(PURPOSE_MAP_PATH, purpose)

    registry = _load_json(PARTNERS_PATH, [])
    registry.append({"partner_id": args.partner_wallet, "wallet": args.partner_wallet})
    _write_json(PARTNERS_PATH, registry)

    result = {
        "confirmation_hash": conf_hash,
        "partner_key": partner_key,
        "manifesto_link": manifest_link,
        "vault_path": str(vault_path),
        "trait_map": str(trait_path),
    }

    _log({"wallet": args.partner_wallet, "bundle": vault_name, "hash": conf_hash})

    return result


# ---------------------------------------------------------------------------


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Vaultfire Fork V2")
    parser.add_argument("--source_protocol", default="vaultfire_v1.json")
    parser.add_argument("--partner_wallet", required=True)
    parser.add_argument("--ethics_locked", action="store_true")
    parser.add_argument("--yield_profile", required=True, choices=list(TRAIT_TIERS.keys()))
    parser.add_argument("--loyalty_engine", default="ghostkey316.logic")
    parser.add_argument("--manifesto", action="store_true", help="Generate manifesto template")
    parser.add_argument("--token_gate", nargs=2, metavar=("CONTRACT", "ID"))
    parser.add_argument("--expiration", type=int)
    return parser.parse_args(argv)


# ---------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    result = generate_bundle(args)
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
