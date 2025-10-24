from __future__ import annotations

import json
from pathlib import Path

import pytest

from vaultfire.x402_gateway import X402Gateway
from vaultfire import x402_hooks


@pytest.fixture()
def reward_gateway(tmp_path: Path) -> X402Gateway:
    gateway = X402Gateway(
        ledger_path=tmp_path / "ledger.jsonl",
        codex_memory_path=tmp_path / "memory.jsonl",
        ghostkey_earnings_path=tmp_path / "ghostkey.jsonl",
        companion_path=tmp_path / "companion.jsonl",
    )
    return gateway


def _assert_reward_payload(payload: dict[str, object], expected_base: float | None) -> None:
    assert "final_multiplier" in payload
    assert pytest.approx(payload["final_multiplier"], rel=1e-6) == 3.16
    if expected_base is None:
        assert payload["final_yield"] is None
    else:
        assert pytest.approx(payload["final_yield"], rel=1e-6) == expected_base * 3.16


def test_run_passive_loop_includes_reward(monkeypatch: pytest.MonkeyPatch, reward_gateway: X402Gateway) -> None:
    monkeypatch.setattr(x402_hooks, "get_default_gateway", lambda: reward_gateway)
    result = x402_hooks.run_passive_loop(amount=1.0)
    reward = result["reward"]
    assert reward["base_amount"] == 1.0
    _assert_reward_payload(reward, 1.0)

    ledger_data = (reward_gateway.ledger_path).read_text(encoding="utf-8").splitlines()
    assert ledger_data, "ledger should record the run"
    last_entry = json.loads(ledger_data[-1])
    assert last_entry["metadata"]["reward"]["final_multiplier"] == pytest.approx(3.16, rel=1e-6)


def test_trigger_belief_mirror_reward(monkeypatch: pytest.MonkeyPatch, reward_gateway: X402Gateway) -> None:
    monkeypatch.setattr(x402_hooks, "get_default_gateway", lambda: reward_gateway)
    result = x402_hooks.trigger_belief_mirror(amount=0.5)
    reward = result["reward"]
    _assert_reward_payload(reward, 0.5)


def test_validate_loyalty_action_reward(monkeypatch: pytest.MonkeyPatch, reward_gateway: X402Gateway) -> None:
    monkeypatch.setattr(x402_hooks, "get_default_gateway", lambda: reward_gateway)
    result = x402_hooks.validate_loyalty_action("ping", signal_strength=0.9, amount=0.25)
    reward = result["reward"]
    _assert_reward_payload(reward, 0.25)
