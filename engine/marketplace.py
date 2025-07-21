# Reference: ethics/core.mdx
"""Marketplace configuration utilities."""

import json
import os
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[1]
CONFIG_PATH = BASE_DIR / "vaultfire-core" / "marketplace_config.json"
LISTINGS_PATH = BASE_DIR / "logs" / "marketplace_items.json"


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


def _load_json(path: Path, default):
    if path.exists():
        try:
            with open(path) as f:
                return json.load(f)
        except json.JSONDecodeError:
            return default
    return default


def _write_json(path: Path, data) -> None:
    os.makedirs(path.parent, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


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


def is_verified_contributor(user) -> bool:
    """Return ``True`` if ``user`` is marked as a verified builder."""
    roles = []
    if isinstance(user, dict):
        roles = user.get("roles", [])
        verified = user.get("verified_contributor", False)
    else:
        roles = getattr(user, "roles", [])
        verified = getattr(user, "verified_contributor", False)
    roles_normalized = [r.lower() for r in roles]
    return verified or "vaultfire builder" in roles_normalized or "verified_contributor" in roles_normalized


def violates_ethics(item) -> bool:
    """Return ``True`` if ``item`` violates the Ghostkey-316 ethics framework."""
    name = item.get("name") if isinstance(item, dict) else str(item)
    return not item_allowed(name)


def store_item(item) -> None:
    """Persist ``item`` to the marketplace listings file."""
    listings = _load_json(LISTINGS_PATH, [])
    listings.append(item)
    _write_json(LISTINGS_PATH, listings)


def list_item(user, item):
    """Validate ``item`` for ``user`` and store it if approved."""
    signal_score = user.get("signal_score") if isinstance(user, dict) else getattr(user, "signal_score", 0)
    if signal_score < 85:
        return "Rejected: Signal Score too low."
    if not is_verified_contributor(user):
        return "Rejected: Not a verified Vaultfire builder."
    if violates_ethics(item):
        return "Rejected: Violates Ghostkey-316 Ethics Framework."

    store_item(item)
    return "Success: Item listed."


def buyer_loyalty_bonus(buyer) -> None:
    """Send a small ASM reward to loyal buyers."""
    score = buyer.get("signal_score") if isinstance(buyer, dict) else getattr(buyer, "signal_score", 0)
    wallet = buyer.get("wallet") if isinstance(buyer, dict) else getattr(buyer, "wallet", None)
    if score is None or wallet is None:
        return None
    if score > 90:
        from .token_ops import send_token
        send_token(wallet, 100, "ASM")
    return None


def seller_yield_boost(seller, item_price: float, item_quality: str) -> None:
    """Grant a yield boost payout based on ``item_quality`` and seller score."""
    base = 0.05
    if item_quality == "legendary":
        base = 0.1
    score = seller.get("signal_score") if isinstance(seller, dict) else getattr(seller, "signal_score", 0)
    wallet = seller.get("wallet") if isinstance(seller, dict) else getattr(seller, "wallet", None)
    if score is None or wallet is None:
        return None
    if score > 95:
        base += 0.05
    amount = item_price * base
    from .token_ops import send_token
    send_token(wallet, amount, "ASM")
    return None


if __name__ == "__main__":
    cfg = _load_config()
    print(cfg)
