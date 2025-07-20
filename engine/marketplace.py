"""Marketplace configuration utilities."""

import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
CONFIG_PATH = BASE_DIR / "vaultfire-core" / "marketplace_config.json"


def _load_config():
    with open(CONFIG_PATH) as f:
        return json.load(f)


def currency_allowed(token: str) -> bool:
    """Return ``True`` if ``token`` is supported by the marketplace."""
    config = _load_config()
    currencies = config.get("currency", [])
    return token in currencies


if __name__ == "__main__":
    cfg = _load_config()
    print(cfg)
