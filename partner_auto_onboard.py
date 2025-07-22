"""Interactive partner onboarding utility."""

from __future__ import annotations

import json
from pathlib import Path

from system_integrity_check import run_integrity_check, ALIGNMENT_PHRASE

BASE_DIR = Path(__file__).resolve().parent
CONFIG_DIR = BASE_DIR / "partners" / "configs"

GREEN = "\033[92m"
RED = "\033[91m"
RESET = "\033[0m"
CHECK = "✅"


def color(text: str, code: str) -> str:
    return f"{code}{text}{RESET}"


def main() -> int:
    print(color("=== Vaultfire Partner Onboarding ===", GREEN))
    ens = input("Enter your ENS: ").strip()
    wallet = input("Yield wallet address: ").strip()
    phrase = input(
        f"Alignment phrase [{ALIGNMENT_PHRASE}]: ").strip() or ALIGNMENT_PHRASE

    print("Running system integrity check...")
    integrity = run_integrity_check()
    issues = [m for msgs in integrity.values() for m in msgs]
    if issues:
        print(color("Integrity check failed:", RED))
        for msg in issues:
            print(color(f"- {msg}", RED))
        return 1

    print(color(f"All systems operational {CHECK}", GREEN))

    data = {
        "ens": ens,
        "yield_wallet": wallet,
        "alignment_phrase": phrase,
    }
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    out_path = CONFIG_DIR / f"{ens}.json"
    with open(out_path, "w") as f:
        json.dump(data, f, indent=2)
    print(color(f"Config saved to {out_path}", GREEN))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
