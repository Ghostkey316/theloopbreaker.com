"""Offline simulation of the partner activation handshake."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from engine.loyalty_engine import update_loyalty_ranks
from engine.identity_resolver import resolve_identity

BASE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = BASE_DIR / "vaultfire-core" / "vaultfire_config.json"
PARTNERS_PATH = BASE_DIR / "partners.json"
ALIGNMENT_PHRASE = "Morals Before Metrics."


def simulate_activation(partner_id: str, wallets: list[str],
                        phrase: str = ALIGNMENT_PHRASE) -> dict:
    """Run activation checks and return a result object."""
    failures: list[str] = []

    if not check_alignment_phrase(phrase):
        failures.append("alignment phrase mismatch")

    if not check_ethics_anchor():
        failures.append("ethics_anchor disabled")

    if not init_loyalty_engine():
        failures.append("loyalty_engine initialization failed")

    success = not failures
    resolved_wallets = resolve_wallets(wallets) if success else wallets
    if success:
        activate_partner(partner_id, resolved_wallets)

    return {
        "partner_id": partner_id,
        "wallets": resolved_wallets,
        "phrase": phrase,
        "success": success,
        "failures": failures,
        "status": "PASS" if success else "FAIL",
    }


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


def check_ethics_anchor() -> bool:
    """Return ``True`` if the ethics anchor is enabled."""
    cfg = _load_json(CONFIG_PATH, {})
    return cfg.get("ethics_anchor", False)


def check_alignment_phrase(phrase: str) -> bool:
    """Validate the provided alignment ``phrase``."""
    return phrase.strip() == ALIGNMENT_PHRASE


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


def activate_partner(partner_id: str, wallets: list[str]) -> None:
    """Persist partner info if not already recorded."""
    partners = _load_json(PARTNERS_PATH, [])
    if any(p.get("partner_id") == partner_id for p in partners):
        return
    entry = {"partner_id": partner_id, "wallet": wallets[0]}
    if len(wallets) > 1:
        entry["wallets"] = wallets
    partners.append(entry)
    _write_json(PARTNERS_PATH, partners)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Simulate partner activation")
    parser.add_argument("partner_id", help="unique partner identifier")
    parser.add_argument("wallet", nargs="+", help="one or more wallet identifiers")
    parser.add_argument("--phrase", default=ALIGNMENT_PHRASE, help="alignment phrase")
    args = parser.parse_args(argv)

    partner_id = args.partner_id
    wallets = args.wallet
    alignment_phrase = args.phrase

    print("Starting partner activation handshake...")
    result = simulate_activation(partner_id, wallets, alignment_phrase)

    if not result["success"]:
        print("Activation failed due to:")
        for msg in result["failures"]:
            print(f"- {msg}")
        print("System integration readiness: FAIL")
        return 1

    print("Activation successful for partner", partner_id)
    print("System integration readiness: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
