from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Dict

import pytest
from pytest import CaptureFixture


@pytest.fixture(autouse=True)
def _configure_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("VAULTFIRE_ENV", "pilot")
    monkeypatch.setenv("VAULTFIRE_SIGNAL_SECRET", "signal-secret")
    monkeypatch.setenv("VAULTFIRE_DEPLOY_SECRET", "deploy-secret")


def _build_signal(timestamp: str) -> Dict[str, Any]:
    from vaultfire.utils import validate_integrity

    secret = os.getenv("VAULTFIRE_SIGNAL_SECRET", "signal-secret")
    import hmac
    import hashlib

    hash_value = hmac.new(secret.encode(), timestamp.encode(), hashlib.sha256).hexdigest()
    assert validate_integrity(hash_value, timestamp)
    return {
        "signal_key": "vaultfire_pilot_sync",
        "timestamp": timestamp,
        "hash": hash_value,
    }


def test_auto_deploy_lambda_triggers_deployment(monkeypatch: pytest.MonkeyPatch) -> None:
    from vaultfire import auto_deploy

    timestamp = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    signal = _build_signal(timestamp)

    captured: Dict[str, Any] = {}

    def fake_deploy_agent_bundle(**kwargs: Any) -> Dict[str, Any]:
        captured.update(kwargs)
        return {"status": "queued"}

    monkeypatch.setattr(auto_deploy, "deploy_agent_bundle", fake_deploy_agent_bundle)

    auto_deploy.auto_deploy_lambda(signal)

    assert captured["agent_id"] == "Ghostkey316"
    assert captured["env"] == "pilot"
    assert captured["mode"] == "pilot"
    assert captured["telemetry"] == "stealth"
    assert len(captured["config_signature"]) == 64


def test_auto_deploy_lambda_rejects_invalid_hash() -> None:
    from vaultfire import auto_deploy

    timestamp = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    signal = {
        "signal_key": "vaultfire_pilot_sync",
        "timestamp": timestamp,
        "hash": "not-a-valid-hash",
    }

    with pytest.raises(auto_deploy.AutoDeployError) as exc:
        auto_deploy.auto_deploy_lambda(signal)

    assert "❌ Signal integrity check failed" in str(exc.value)


def test_auto_deploy_lambda_ignores_unknown_signal(
    monkeypatch: pytest.MonkeyPatch, capsys: CaptureFixture[str]
) -> None:
    from vaultfire import auto_deploy

    called = False

    def fake_deploy_agent_bundle(**_: Any) -> None:
        nonlocal called
        called = True

    monkeypatch.setattr(auto_deploy, "deploy_agent_bundle", fake_deploy_agent_bundle)

    auto_deploy.auto_deploy_lambda({"signal_key": "unknown"})

    captured = capsys.readouterr()
    assert "Unknown signal" in captured.out
    assert not called
