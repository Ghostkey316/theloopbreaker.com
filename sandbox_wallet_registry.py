"""Sandbox wallet registry stewarding mission-aligned pilot cohorts."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable, MutableMapping


BASE_DIR = Path(__file__).resolve().parent
REGISTRY_PATH = BASE_DIR / "sandbox_wallet_registry.json"
MIN_WALLETS = 250_000
MAX_WALLETS = 750_000
MAX_SAMPLE_SIZE = 1_000


def _load_json(path: Path) -> MutableMapping[str, object]:
    if not path.exists():
        return {}
    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except json.JSONDecodeError:
        return {}


def _write_json(path: Path, payload: MutableMapping[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, sort_keys=True)


def _fingerprint(wallet_id: str) -> str:
    return hashlib.sha256(wallet_id.strip().lower().encode("utf-8")).hexdigest()


@dataclass
class SandboxWalletRegistry:
    """Manage sandbox pilot wallets with deterministic capacity tracking."""

    path: Path = REGISTRY_PATH
    metadata: MutableMapping[str, object] = field(default_factory=dict)
    total_wallets: int = 0
    sampled_wallets: set[str] = field(default_factory=set)
    _fingerprints: set[str] = field(default_factory=set, init=False, repr=False)

    def __post_init__(self) -> None:
        stored = _load_json(self.path)
        self.metadata = {
            "min_wallets": MIN_WALLETS,
            "max_wallets": MAX_WALLETS,
            "sample_limit": MAX_SAMPLE_SIZE,
            "mission_aligned_verticals": ["media", "crypto", "social"],
            **(stored.get("metadata") or {}),
        }
        self.total_wallets = int(stored.get("totals", {}).get("unique_wallets", 0))
        self.sampled_wallets = set(stored.get("sampled_wallets", []))
        self._fingerprints = set(stored.get("fingerprints", []))

    # public API ---------------------------------------------------------
    def register_wallet(self, wallet_id: str) -> bool:
        """Register ``wallet_id`` if it has not been seen before.

        Returns ``True`` when the wallet is new which helps upstream callers
        understand whether additional onboarding is required.
        """

        if not wallet_id:
            return False
        fingerprint = _fingerprint(wallet_id)
        if fingerprint in self._fingerprints:
            return False
        self._fingerprints.add(fingerprint)
        self.total_wallets += 1
        normalized = wallet_id.strip()
        if len(self.sampled_wallets) < MAX_SAMPLE_SIZE:
            self.sampled_wallets.add(normalized)
        self.persist()
        return True

    def register_many(self, wallets: Iterable[str]) -> dict:
        new_entries = 0
        for wallet in wallets:
            if self.register_wallet(wallet):
                new_entries += 1
        return {"registered": self.total_wallets, "new_entries": new_entries, "status": self.capacity_status}

    @property
    def capacity_status(self) -> str:
        if self.total_wallets < MIN_WALLETS:
            return "under_target"
        if self.total_wallets > MAX_WALLETS:
            return "over_capacity"
        return "within_range"

    def snapshot(self) -> dict:
        return {
            "metadata": self.metadata,
            "totals": {
                "unique_wallets": self.total_wallets,
                "capacity_status": self.capacity_status,
            },
            "sampled_wallets": sorted(self.sampled_wallets),
        }

    def persist(self) -> None:
        payload = self.snapshot()
        payload["fingerprints"] = sorted(self._fingerprints)
        _write_json(self.path, payload)


def load_registry(path: Path | None = None) -> SandboxWalletRegistry:
    """Convenience helper returning a registry bound to ``path``."""

    return SandboxWalletRegistry(path=path or REGISTRY_PATH)


__all__ = ["SandboxWalletRegistry", "load_registry", "MIN_WALLETS", "MAX_WALLETS"]

