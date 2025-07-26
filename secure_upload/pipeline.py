"""High level secure upload pipeline."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from belief_trigger_engine import evaluate_wallet
from vaultfire_securestore import SecureStore

__all__ = ["upload_file"]


def upload_file(
    store: SecureStore,
    file_path: Path,
    wallet: str,
    tier: str,
    score: int,
    *,
    webhook: str | None = None,
    chain_log: bool = True,
) -> dict[str, Any]:
    """Process ``file_path`` through SecureStore and belief engine."""
    meta = store.encrypt_and_store(
        file_path,
        wallet,
        tier,
        score,
        webhook=webhook,
        chain_log=chain_log,
    )
    evaluate_wallet(wallet, chain_log=chain_log, webhook=webhook)
    return meta
