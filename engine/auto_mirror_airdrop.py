from __future__ import annotations

"""Auto-Mirror Airdrop engine for Vaultfire.

This module scans supported public networks for posts that match
Vaultfire belief phrases and automatically rewards the associated
wallets. Network requests are optional and fail gracefully if the
required dependency is not installed or the endpoint is unreachable.
"""

import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Iterable

try:
    import requests  # type: ignore
except Exception:  # pragma: no cover - requests may not be installed
    requests = None

from .token_ops import send_token

BASE_DIR = Path(__file__).resolve().parents[1]
VALUES_PATH = BASE_DIR / "vaultfire-core" / "ghostkey_values.json"
LOG_PATH = BASE_DIR / "logs" / "airdrop_log.json"

# Simple public API templates. These may change without notice.
PUBLIC_APIS = {
    "farcaster": "https://api.neynar.com/v2/farcaster/search?text={}",
    "lens": "https://lens.xyz/api/search?q={}",
    "ns3": "https://ns3.xyz/api/search?term={}",
    "gitcoin": "https://gitcoin.co/api/v0/grants?keyword={}",
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


def _belief_phrases() -> List[str]:
    data = _load_json(VALUES_PATH, {})
    phrases = []
    for key in data.keys():
        if key.endswith("multipliers"):
            continue
        phrases.append(key.replace("_", " "))
    return phrases


def _fetch_activity(provider: str, phrase: str) -> List[Dict]:
    """Return list of events from ``provider`` matching ``phrase``."""
    if provider not in PUBLIC_APIS or not requests:
        return []
    try:
        url = PUBLIC_APIS[provider].format(phrase)
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        data = resp.json()
    except Exception:  # pragma: no cover - network issues
        return []

    events = []
    if provider == "farcaster":
        for cast in data.get("casts", []):
            events.append({
                "wallet": cast.get("author", {}).get("address"),
                "content": cast.get("text", ""),
                "provider": provider,
            })
    elif provider == "lens":
        for post in data.get("data", []):
            events.append({
                "wallet": post.get("profile", {}).get("ownedBy"),
                "content": post.get("metadata", {}).get("content", ""),
                "provider": provider,
            })
    elif provider == "ns3":
        for item in data.get("results", []):
            events.append({
                "wallet": item.get("wallet"),
                "content": item.get("text", ""),
                "provider": provider,
            })
    else:  # gitcoin or unknown structure
        for grant in data.get("data", []):
            events.append({
                "wallet": grant.get("address"),
                "content": grant.get("title", ""),
                "provider": provider,
            })
    return events


def scan_public_activity(
    beliefs: Iterable[str] | None = None,
    providers: Iterable[str] | None = None,
) -> List[Dict]:
    """Return list of matched events across ``providers``."""
    if beliefs is None:
        beliefs = _belief_phrases()
    if providers is None:
        providers = PUBLIC_APIS.keys()

    found: List[Dict] = []
    for provider in providers:
        for phrase in beliefs:
            events = _fetch_activity(provider, phrase)
            phrase_lower = phrase.lower()
            for evt in events:
                text = (evt.get("content") or "").lower()
                wallet = evt.get("wallet")
                if wallet and phrase_lower in text:
                    found.append({"wallet": wallet, "provider": provider, "phrase": phrase})
    return found


def execute_airdrop(events: List[Dict], amount: float = 1.0, token: str = "ASM") -> List[Dict]:
    """Reward wallets for matched events and log the distribution."""
    ledger = _load_json(LOG_PATH, [])
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    new_entries = []
    for evt in events:
        wallet = evt.get("wallet")
        if not wallet:
            continue
        send_token(wallet, amount, token)
        entry = {
            "timestamp": timestamp,
            "wallet": wallet,
            "token": token,
            "amount": amount,
            "provider": evt.get("provider"),
            "phrase": evt.get("phrase"),
        }
        ledger.append(entry)
        new_entries.append(entry)
    _write_json(LOG_PATH, ledger)
    return new_entries


def run_airdrop():
    matches = scan_public_activity()
    if not matches:
        return []
    return execute_airdrop(matches)


if __name__ == "__main__":  # pragma: no cover - manual trigger
    result = run_airdrop()
    print(json.dumps(result, indent=2))
