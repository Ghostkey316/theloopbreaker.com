"""Offline simulation of the partner activation handshake."""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime
from pathlib import Path

from engine import storage
from engine.loyalty_engine import update_loyalty_ranks
from engine.identity_resolver import resolve_identity
from system_integrity_check import run_integrity_check

BASE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = BASE_DIR / "vaultfire-core" / "vaultfire_config.json"
PARTNERS_PATH = BASE_DIR / "partners.json"
ALIGNMENT_PHRASE = "Morals Before Metrics."


def simulate_activation(partner_id: str, wallets: list[str],
                        phrase: str = ALIGNMENT_PHRASE,
                        test_mode: bool = False) -> dict:
    """Run activation checks and return a result object."""
    failures: list[str] = []

    if not partner_id:
        failures.append("partner_id missing")
    if not wallets:
        failures.append("wallets missing")

    if not check_alignment_phrase(phrase):
        failures.append("alignment phrase mismatch")

    if not check_ethics_anchor():
        failures.append("ethics_anchor disabled")

    if not init_loyalty_engine():
        failures.append("loyalty_engine initialization failed")

    success = not failures
    resolved_wallets = resolve_wallets(wallets) if success else wallets
    if success and not test_mode:
        activate_partner(partner_id, wallets, resolved_wallets)

    return {
        "partner_id": partner_id,
        "wallets": resolved_wallets,
        "input_wallets": wallets,
        "phrase": phrase,
        "success": success,
        "failures": failures,
        "status": "PASS" if success else "FAIL",
    }


def _load_json(path: Path, default):
    return storage.load_data(path, default)


def _write_json(path: Path, data) -> None:
    storage.write_data(path, data)


def _alignment_signature(phrase: str) -> str:
    """Return a deterministic signature for the alignment phrase."""
    normalized = phrase.strip().lower().encode("utf-8")
    return hashlib.sha256(normalized).hexdigest()


def check_ethics_anchor() -> bool:
    """Return ``True`` if the ethics anchor is enabled."""
    cfg = _load_json(CONFIG_PATH, {})
    return cfg.get("ethics_anchor", False)


def check_alignment_phrase(phrase: str) -> bool:
    """Validate the provided alignment ``phrase`` (case-insensitive)."""
    return phrase.strip().lower() == ALIGNMENT_PHRASE.lower()


def init_loyalty_engine() -> bool:
    """Initialize the loyalty engine."""
    try:
        update_loyalty_ranks()
    except Exception:
        return False
    return True


def resolve_wallets(wallets: list[str]) -> list[str]:
    """Resolve wallet identifiers for future Web3 integration."""
    resolved = []
    for w in wallets:
        addr = resolve_identity(w) or w
        resolved.append(addr)
    return resolved


def activate_partner(partner_id: str, wallets: list[str],
                    resolved_wallets: list[str]) -> None:
    """Persist partner info if not already recorded."""
    partners = _load_json(PARTNERS_PATH, [])
    if any(p.get("partner_id") == partner_id for p in partners):
        return
    timestamp = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
    entry = {
        "partner_id": partner_id,
        "wallet": resolved_wallets[0],
        "wallet_alias": wallets[0],
        "resolved_wallet": resolved_wallets[0],
        "alignment_signature": _alignment_signature(ALIGNMENT_PHRASE),
        "onboarded_at": timestamp,
    }
    if len(wallets) > 1:
        entry["wallets"] = resolved_wallets
        entry["wallet_aliases"] = wallets
    partners.append(entry)
    _write_json(PARTNERS_PATH, partners)


def activation_hook(partner_id: str, wallets: list[str],
                    phrase: str = ALIGNMENT_PHRASE,
                    silent: bool = False,
                    test_mode: bool = False) -> dict:
    """Run activation and integrity checks and return a result object."""
    activation = simulate_activation(partner_id, wallets, phrase, test_mode)
    integrity = run_integrity_check()
    errors = activation["failures"][:]
    for section, msgs in integrity.items():
        errors.extend(f"{section}: {m}" for m in msgs)
    status = "PASS" if not errors else "FAIL"
    result = {
        "partner_id": partner_id,
        "wallets": activation["wallets"],
        "status": status,
        "errors": errors,
        "activation": activation,
        "integrity": integrity,
    }
    if not silent:
        print(json.dumps(result, indent=2))
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Simulate partner activation")
    parser.add_argument("partner_id", help="unique partner identifier")
    parser.add_argument("wallet", nargs="+", help="one or more wallet identifiers")
    parser.add_argument("--phrase", default=ALIGNMENT_PHRASE, help="alignment phrase")
    parser.add_argument("--silent", action="store_true", help="suppress console output")
    parser.add_argument("--test-mode", action="store_true", help="do not persist changes")
    parser.add_argument("--hook", action="store_true", help="return JSON activation hook output")
    args = parser.parse_args(argv)

    partner_id = args.partner_id
    wallets = args.wallet
    alignment_phrase = args.phrase
    silent = args.silent
    test_mode = args.test_mode

    if args.hook:
        result = activation_hook(partner_id, wallets, alignment_phrase,
                                 silent=silent, test_mode=test_mode)
        return 0 if result["status"] == "PASS" else 1

    if not silent:
        print("Starting partner activation handshake...")
    result = simulate_activation(partner_id, wallets, alignment_phrase, test_mode)

    if not result["success"]:
        if not silent:
            print("Activation failed due to:")
            for msg in result["failures"]:
                print(f"- {msg}")
            print("System integration readiness: FAIL")
        return 1

    if not silent:
        print("Activation successful for partner", partner_id)
        print("System integration readiness: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
