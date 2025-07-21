"""Offline simulation of the partner activation handshake."""

from __future__ import annotations

import json
from pathlib import Path

from engine.loyalty_engine import update_loyalty_ranks

BASE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = BASE_DIR / "vaultfire-core" / "vaultfire_config.json"
PARTNERS_PATH = BASE_DIR / "partners.json"
ALIGNMENT_PHRASE = "Morals Before Metrics."


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
    cfg = _load_json(CONFIG_PATH, {})
    return cfg.get("ethics_anchor", False)


def init_loyalty_engine() -> bool:
    try:
        update_loyalty_ranks()
    except Exception:
        return False
    return True


def main() -> int:
    partner_id = "demo_partner"
    wallet_address = "demo_wallet.eth"
    alignment_phrase = ALIGNMENT_PHRASE

    print("Starting partner activation handshake...")
    failures = []

    if alignment_phrase.strip() != ALIGNMENT_PHRASE:
        failures.append("alignment phrase mismatch")

    if not check_ethics_anchor():
        failures.append("ethics_anchor disabled")

    if not init_loyalty_engine():
        failures.append("loyalty_engine initialization failed")

    if failures:
        print("Activation failed due to:")
        for msg in failures:
            print(f"- {msg}")
        print("System integration readiness: FAIL")
        return 1

    partners = _load_json(PARTNERS_PATH, [])
    if not any(p.get("partner_id") == partner_id for p in partners):
        partners.append({"partner_id": partner_id, "wallet": wallet_address})
        _write_json(PARTNERS_PATH, partners)

    print("Activation successful for partner", partner_id)
    print("System integration readiness: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
