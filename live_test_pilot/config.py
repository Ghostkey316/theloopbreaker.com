"""Configuration helpers for the live test pilot deployment."""
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict

CONFIG_PATH = Path(__file__).resolve().parents[1] / "vaultfire_config.json"
DEFAULT_TELEMETRY_INTERVAL = 60 * 60 * 24  # 24 hours


@dataclass(slots=True)
class LiveTestConfig:
    """Represents the configuration required for the live test pilot."""

    system_name: str
    live_test_flag: bool
    telemetry_interval_seconds: int
    audit_metadata: Dict[str, Any]
    synthetic_wallets: list[dict]


def _load_file(path: Path) -> Dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(f"Missing configuration file: {path}")
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _resolve_interval(raw: Any) -> int:
    if raw is None:
        return DEFAULT_TELEMETRY_INTERVAL
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return DEFAULT_TELEMETRY_INTERVAL
    return max(value, 60)


def load_config(*, config_path: Path | None = None) -> LiveTestConfig:
    """Load the Vaultfire config and synthesize pilot-specific metadata."""

    path = config_path or CONFIG_PATH
    data = _load_file(path)
    telemetry_interval_env = os.getenv("VAULTFIRE_METRICS_INTERVAL")
    telemetry_interval = _resolve_interval(
        telemetry_interval_env or data.get("telemetry_interval_seconds")
    )
    synthetic_wallets = data.get(
        "synthetic_wallets",
        [
            {"wallet_id": "demo-wallet-001", "ens": "demo1.test", "label": "Community Uplift"},
            {"wallet_id": "demo-wallet-002", "ens": "demo2.test", "label": "Ethics Anchor"},
            {"wallet_id": "demo-wallet-003", "ens": "demo3.test", "label": "Guardian Loop"},
        ],
    )
    audit_metadata = data.get(
        "live_test_audit_metadata",
        {
            "hook": "third-party-audit",
            "provider": "Vaultfire Compliance Sandbox",
            "contact": "audit@vaultfire.local",
        },
    )
    return LiveTestConfig(
        system_name=data.get("system_name", "Vaultfire"),
        live_test_flag=bool(data.get("live_test_flag")),
        telemetry_interval_seconds=telemetry_interval,
        audit_metadata=audit_metadata,
        synthetic_wallets=list(synthetic_wallets),
    )


__all__ = ["LiveTestConfig", "load_config"]
