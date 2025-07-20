"""Marketplace configuration utilities."""

import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
CONFIG_PATH = BASE_DIR / "vaultfire-core" / "marketplace_config.json"


LISTABLE_CATEGORIES = [
    "Verified Vaultfire Tools",
    "Prompt Blueprints",
    "Signal Engine Extensions",
    "Ethical Culture NFTs",
    "Codex Hacks / Protocol Enhancements",
    "IRL Gear from Contributors",
]

BANNED_ITEMS = [
    "Pump Signals",
    "Clickbait Prompts",
    "Hype NFTs",
    "Fake AI Agents",
]


def _load_config():
    with open(CONFIG_PATH) as f:
        return json.load(f)


def currency_allowed(token: str) -> bool:
    """Return ``True`` if ``token`` is supported by the marketplace."""
    config = _load_config()
    currencies = config.get("currency", [])
    return token in currencies


def category_allowed(category: str) -> bool:
    """Return ``True`` if ``category`` is listed in the marketplace."""
    config = _load_config()
    categories = config.get("categories")
    if categories is None:
        categories = LISTABLE_CATEGORIES
    return category in categories


def item_allowed(item: str) -> bool:
    """Return ``True`` if ``item`` is not banned from the marketplace."""
    config = _load_config()
    banned = config.get("banned_items")
    if banned is None:
        banned = BANNED_ITEMS
    return item not in banned


if __name__ == "__main__":
    cfg = _load_config()
    print(cfg)
