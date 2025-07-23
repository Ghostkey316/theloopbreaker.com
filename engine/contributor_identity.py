# Reference: ethics/core.mdx
"""Unified contributor identity sync system."""

import json
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, List

if __package__:
    from .identity_resolver import resolve_identity
else:  # pragma: no cover - executed as script
    import sys
    import importlib
    CURRENT = Path(__file__).resolve()
    sys.path.append(str(CURRENT.parents[1]))
    identity_resolver = importlib.import_module("engine.identity_resolver")
    resolve_identity = identity_resolver.resolve_identity

BASE_DIR = Path(__file__).resolve().parents[1]
IDENTITY_PATH = BASE_DIR / "user_identity.json"
LEDGER_PATH = BASE_DIR / "logs" / "token_ledger.json"


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


def sync_identity(user_id: str, wallet: Optional[str] = None,
                  socials: Optional[Dict[str, str]] = None,
                  behaviors: Optional[List[str]] = None) -> Dict:
    """Link ``wallet``, ``socials`` and ``behaviors`` for ``user_id``."""
    data = _load_json(IDENTITY_PATH, {})
    profile = data.get(user_id, {"wallets": [], "socials": {}, "behavior_score": 0, "history": [], "verified": []})

    if wallet:
        resolved = resolve_identity(wallet)
        if resolved or wallet not in profile["wallets"]:
            profile["wallets"].append(wallet)
            if resolved:
                verified = set(profile.get("verified", []))
                verified.add(wallet)
                profile["verified"] = sorted(verified)

    if socials:
        social_map = profile.get("socials", {})
        social_map.update(socials)
        profile["socials"] = social_map

    if behaviors:
        profile["behavior_score"] = profile.get("behavior_score", 0) + len(behaviors)
        history = profile.get("history", [])
        timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        for b in behaviors:
            history.append({"timestamp": timestamp, "event": b})
        profile["history"] = history

    data[user_id] = profile
    _write_json(IDENTITY_PATH, data)
    return identity_summary(user_id)


# ---------------------------------------------------------------------------


def _reputation_multiplier(profile: Dict) -> float:
    mul = 1.0
    mul += 0.1 * len(profile.get("verified", []))
    mul += 0.05 * len([h for h in profile.get("socials", {}).values() if h])
    mul += profile.get("behavior_score", 0) / 100
    return round(mul, 3)


def _access_level(multiplier: float) -> str:
    if multiplier >= 1.5:
        return "core"
    if multiplier >= 1.2:
        return "trusted"
    return "basic"


def identity_summary(user_id: str) -> Dict:
    data = _load_json(IDENTITY_PATH, {})
    profile = data.get(user_id, {"wallets": [], "socials": {}, "behavior_score": 0, "history": [], "verified": []})
    ledger = _load_json(LEDGER_PATH, [])
    rewards = {}
    for w in profile.get("wallets", []):
        rewards[w] = sum(e.get("amount", 0) for e in ledger if e.get("wallet") == w)
    multiplier = _reputation_multiplier(profile)
    summary = {
        "user_id": user_id,
        "wallets": profile.get("wallets", []),
        "socials": profile.get("socials", {}),
        "behavior_score": profile.get("behavior_score", 0),
        "rewards": rewards,
        "reputation_multiplier": multiplier,
        "access_level": _access_level(multiplier),
    }
    return summary


def retroactive_bonus(user_id: str) -> float:
    summary = identity_summary(user_id)
    return round(summary["behavior_score"] * 0.1 * summary["reputation_multiplier"], 2)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Sync contributor identity")
    parser.add_argument("--user", required=True)
    parser.add_argument("--wallet")
    parser.add_argument("--social", action="append", help="key=value")
    parser.add_argument("--behavior", action="append")
    args = parser.parse_args()

    socials = {}
    if args.social:
        for item in args.social:
            if "=" in item:
                k, v = item.split("=", 1)
                socials[k] = v

    profile = sync_identity(args.user, args.wallet, socials or None, args.behavior)
    print(json.dumps(identity_summary(args.user), indent=2))
