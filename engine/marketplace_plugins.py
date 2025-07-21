"""External marketplace integration utilities for Vaultfire."""

import json
from pathlib import Path
from typing import Optional
from urllib import parse, request

BASE_DIR = Path(__file__).resolve().parents[1]
LINKS_PATH = BASE_DIR / "logs" / "external_marketplace_links.json"


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


# ---------------------------------------------------------------------------
# URL helpers


def opensea_asset_url(contract_address: str, token_id: str) -> str:
    """Return a URL to view ``token_id`` of ``contract_address`` on OpenSea."""
    base = "https://opensea.io/assets"
    addr = contract_address.strip()
    tid = token_id.strip()
    return f"{base}/{addr}/{tid}"


def github_sponsors_url(username: str) -> str:
    """Return a GitHub Sponsors page URL for ``username``."""
    return f"https://github.com/sponsors/{username.strip()}"


def dapp_store_url(app_id: str, base_url: str | None = None) -> str:
    """Return a dApp store URL for ``app_id``.``base_url`` can override default."""
    base = base_url or "https://dapps.example.com/apps"
    return f"{base}/{parse.quote(app_id)}"


# ---------------------------------------------------------------------------
# Link recording


def record_link(item_id: str, marketplace: str, url: str) -> dict:
    """Record an external marketplace link for an item."""
    entry = {"item_id": item_id, "marketplace": marketplace, "url": url}
    log = _load_json(LINKS_PATH, [])
    log.append(entry)
    _write_json(LINKS_PATH, log)
    return entry


# ---------------------------------------------------------------------------
# Optional fetch utilities (may fail if network is disabled)


def fetch_json(url: str) -> Optional[dict]:
    """Return JSON data from ``url`` if possible, else ``None``."""
    try:
        with request.urlopen(url, timeout=5) as res:
            if "application/json" in res.headers.get("Content-Type", ""):
                return json.load(res)
    except Exception:
        return None
    return None
