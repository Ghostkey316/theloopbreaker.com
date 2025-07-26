"""Vaultfire v1.12 Retroactive Rewards Module."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, Tuple

SNAPSHOT_DIR = Path("memory_snapshots")
REWARD_PATH = Path("retroactive_rewards.json")

# Growth thresholds and reward mapping (percentage increase -> (tier, multiplier, asm))
GROWTH_TIERS: Tuple[Tuple[float, str, float, int], ...] = (
    (0.5, "Tier 3", 1.5, 150),
    (0.25, "Tier 2", 1.25, 75),
    (0.10, "Tier 1", 1.1, 25),
)


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


def _snapshot_files() -> list[Path]:
    return sorted(SNAPSHOT_DIR.glob("wallet_memory_*.json"))


def _growth_ratio(start: float, end: float) -> float:
    if start <= 0:
        if end > start:
            return 1.0
        return 0.0
    return (end - start) / start


def _tier_for_growth(growth: float) -> Tuple[str, float, int] | None:
    for threshold, tier, mult, asm in GROWTH_TIERS:
        if growth >= threshold:
            return tier, mult, asm
    return None


def calculate_retro_rewards() -> Dict[str, Dict[str, float | int | str]]:
    files = _snapshot_files()
    if len(files) < 2:
        return {}
    first = _load_json(files[0], {})
    last = _load_json(files[-1], {})
    rewards: Dict[str, Dict[str, float | int | str]] = {}
    for wallet, info in last.items():
        start = first.get(wallet, {}).get("score", 0)
        end = info.get("score", 0)
        growth = _growth_ratio(start, end)
        tier_info = _tier_for_growth(growth)
        if tier_info:
            tier, mult, asm = tier_info
            rewards[wallet] = {
                "tier": tier,
                "multiplier": mult,
                "asm": asm,
            }
    return rewards


def write_retro_rewards(rewards: Dict[str, Dict[str, float | int | str]]) -> None:
    _write_json(REWARD_PATH, rewards)


__all__ = ["calculate_retro_rewards", "write_retro_rewards"]
