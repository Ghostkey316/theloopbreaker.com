"""Biofeedback data connectors for Vaultfire Health Node."""
from __future__ import annotations

import json
import hashlib
from pathlib import Path
from typing import Dict, Optional

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_PATH = BASE_DIR / "logs" / "biofeedback_data.json"


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


def _hash_id(identifier: str) -> str:
    return hashlib.sha256(identifier.encode()).hexdigest()


class BiofeedbackProvider:
    """Base class for biofeedback API connectors."""

    def fetch_data(self, token: str) -> Dict[str, float]:
        raise NotImplementedError


class AppleHealthProvider(BiofeedbackProvider):
    def fetch_data(self, token: str) -> Dict[str, float]:
        # Placeholder for actual Apple HealthKit integration
        return {"hrv": 60.0, "blood_pressure": 120.0, "glucose": 90.0}


class FitbitProvider(BiofeedbackProvider):
    def fetch_data(self, token: str) -> Dict[str, float]:
        # Placeholder for Fitbit API
        return {"hrv": 55.0, "blood_pressure": 118.0, "glucose": 95.0}


class WhoopProvider(BiofeedbackProvider):
    def fetch_data(self, token: str) -> Dict[str, float]:
        # Placeholder for WHOOP API
        return {"hrv": 50.0, "blood_pressure": 117.0, "glucose": 92.0}


PROVIDERS = {
    "apple_health": AppleHealthProvider(),
    "fitbit": FitbitProvider(),
    "whoop": WhoopProvider(),
}


def record_biofeedback(identifier: str, provider: str, metrics: Dict[str, float]) -> None:
    """Store metrics for ``identifier`` with hashed ID."""
    hashed = _hash_id(identifier)
    data = _load_json(DATA_PATH, {})
    user = data.get(hashed, {})
    user.update(metrics)
    user["provider"] = provider
    data[hashed] = user
    _write_json(DATA_PATH, data)


def fetch_from_provider(identifier: str, provider_name: str, token: str) -> Optional[Dict[str, float]]:
    """Retrieve data from ``provider_name`` and record it."""
    provider = PROVIDERS.get(provider_name)
    if not provider:
        return None
    metrics = provider.fetch_data(token)
    record_biofeedback(identifier, provider_name, metrics)
    return metrics


def get_latest_biofeedback(identifier: str) -> Dict[str, float]:
    """Return stored metrics for ``identifier`` if available."""
    hashed = _hash_id(identifier)
    data = _load_json(DATA_PATH, {})
    return data.get(hashed, {})
