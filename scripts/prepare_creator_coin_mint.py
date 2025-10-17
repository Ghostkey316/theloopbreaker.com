from __future__ import annotations

"""Prepare a Zora mint payload for the Ghostkey-316 Creator Coin."""

import json
from datetime import datetime, timezone
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
PROTOCOL_PATH = BASE_DIR / "protocol" / "creator_coin_protocol.json"
OUTPUT_PATH = BASE_DIR / "logs" / "creator_coin_mint_preview.json"


def load_protocol() -> dict:
    """Load the Creator Coin protocol manifest."""

    with open(PROTOCOL_PATH, encoding="utf-8") as handle:
        return json.load(handle)


def build_zora_payload(protocol: dict) -> dict:
    """Build a Zora Creator 1155 mint payload."""

    creator = protocol.get("creator_coin", {})
    eligibility = protocol.get("eligibility", {})
    timestamp = datetime.now(timezone.utc).isoformat()
    return {
        "network": protocol.get("network", "base"),
        "symbol": creator.get("symbol", "GHOSTKEY"),
        "alias": creator.get("alias", []),
        "mint_platform": creator.get("mint_platform", "Zora"),
        "contract_template": creator.get("contract_template", "zora-creator-1155-v2"),
        "linked_assets": creator.get("linked_assets", {}),
        "supply_policy": creator.get("supply_policy", "adaptive-liquidity-bonding"),
        "eligibility_tags": eligibility.get("tags", []),
        "mint_guardian": {
            "manifesto": creator.get("issuance_logic", {}).get("manifesto_reference"),
            "passive_yield_engine": creator.get("issuance_logic", {}).get("yield_engine_hook"),
            "codex_manifest": creator.get("issuance_logic", {}).get("codex_manifest_reference"),
        },
        "royalty_policy": protocol.get("royalty_policy", {}),
        "partner_activation": protocol.get("partner_activation", []),
        "prepared_at": timestamp,
    }


def write_preview(payload: dict) -> None:
    """Persist the mint payload so partner flows can inspect it."""

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)


def main() -> None:
    protocol = load_protocol()
    payload = build_zora_payload(protocol)
    write_preview(payload)
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
