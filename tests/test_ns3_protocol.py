from __future__ import annotations

import importlib
import json

import pytest

try:  # pragma: no cover - optional dependency for NS3 protocol encryption
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM  # type: ignore  # noqa: F401
    from cryptography.exceptions import InvalidTag  # type: ignore  # noqa: F401
except (ImportError, ModuleNotFoundError):  # pragma: no cover - skip module when unavailable
    CRYPTOGRAPHY_AVAILABLE = False
else:  # pragma: no cover - executed when dependency present
    CRYPTOGRAPHY_AVAILABLE = True


pytestmark = pytest.mark.skipif(
    not CRYPTOGRAPHY_AVAILABLE,
    reason="[optional] cryptography is required for NS3 protocol tests",
)


def _reload_protocol():
    module = importlib.import_module("ns3.protocol")
    return importlib.reload(module)


def test_yield_loop_events(tmp_path, monkeypatch):
    log_path = tmp_path / "yield.log"
    metadata_path = tmp_path / "metadata.json"
    metadata_path.write_text(
        json.dumps({"metadata_lock": {"ens": "ghostkey316.eth"}}),
        encoding="utf-8",
    )

    monkeypatch.setenv("NS3_YIELD_LOG", str(log_path))
    monkeypatch.setenv("NS3_METADATA_PATH", str(metadata_path))

    protocol = _reload_protocol()

    install_record = protocol.install_passive_yield_engine(wallet="wallet_123")
    loyalty_record = protocol.sync_behavior_to_loyalty_chain(
        wallet="wallet_123", origin="Ghostkey316"
    )
    activation_record = protocol.activate_weekly_yield_distribution(start_immediately=True)
    validation_record = protocol.validate_origin_rewards(origin_id="Ghostkey316")
    multiplier_record = protocol.apply_multiplier_for_ghostkey(
        wallet="wallet_123", level="Genesis++"
    )

    assert install_record["status"] == "installed"
    assert loyalty_record["origin"] == "Ghostkey316"
    assert activation_record["start_immediately"] is True
    assert validation_record["verified"] is True
    assert multiplier_record["multiplier"] > 1

    entries = [json.loads(line) for line in log_path.read_text(encoding="utf-8").splitlines()]
    assert [entry["action"] for entry in entries] == [
        "install_passive_yield_engine",
        "sync_behavior_to_loyalty_chain",
        "activate_weekly_yield_distribution",
        "validate_origin_rewards",
        "apply_multiplier_for_ghostkey",
    ]
    assert entries[-1]["level"] == "Genesis++"


def test_invalid_multiplier_level(tmp_path, monkeypatch):
    log_path = tmp_path / "yield.log"
    monkeypatch.setenv("NS3_YIELD_LOG", str(log_path))
    monkeypatch.delenv("NS3_METADATA_PATH", raising=False)

    protocol = _reload_protocol()

    with pytest.raises(ValueError):
        protocol.apply_multiplier_for_ghostkey(wallet="wallet_123", level="Unknown")
