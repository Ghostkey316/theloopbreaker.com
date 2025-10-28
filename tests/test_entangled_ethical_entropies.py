"""Tests for the Entangled Ethical Entropies (E3) diffusion module."""

from __future__ import annotations

from types import SimpleNamespace

import numpy as np
import pytest

from vaultfire.protocol.constants import MISSION_STATEMENT


@pytest.fixture(autouse=True)
def patch_symbiotic_interface(monkeypatch):
    """Provide a deterministic Symbiotic Sentience Interface stub for tests."""

    class StubInterface:
        def __init__(self, mission_anchor: str) -> None:
            self.mission_anchor = mission_anchor
            self._emitter = None

        def bind_stream_emitter(self, emitter):  # noqa: D401
            self._emitter = emitter

        def capture_neural_intent(self, wallet: str) -> dict[str, float]:
            return {"alpha_power": 0.92, "theta_intent": "align", "wallet": wallet}

        def co_evolve_moral_gradient(self, neural_intent, gradient: float) -> float:
            _ = neural_intent
            return float(np.clip(gradient + 0.08, 0.0, 1.0))

    monkeypatch.setattr("services.entangled_ethical_entropies.SymbioticSentienceInterface", StubInterface)


def test_shard_wallet_intent(monkeypatch):
    """Wallet shards should be deterministic, bounded, and privacy-preserving."""

    monkeypatch.setattr("services.entangled_ethical_entropies.generate_proof", lambda payload: "zk_valid")
    monkeypatch.setattr(
        "services.entangled_ethical_entropies.get_live_oracle",
        lambda: SimpleNamespace(emit_event=lambda *args, **kwargs: {"tx_hash": "0x" + "1" * 64}),
    )
    from services.entangled_ethical_entropies import EntangledEthicalEntropies

    engine = EntangledEthicalEntropies(MISSION_STATEMENT, shard_dim=3)
    shard = engine.shard_wallet_intent("0xabc", 0.74)
    assert isinstance(shard, np.ndarray)
    assert shard.shape == (3,)
    assert np.all(shard >= 0.0)
    assert np.all(shard < 1.0)
    shard_repeat = engine.shard_wallet_intent("0xabc", 0.74)
    np.testing.assert_allclose(shard, shard_repeat)


def test_entangle_high_entropy(monkeypatch):
    """Diffusion loop should yield high entropy and Base-compatible tx hashes."""

    monkeypatch.setattr("services.entangled_ethical_entropies.generate_proof", lambda payload: "zk_valid")
    monkeypatch.setattr("services.entangled_ethical_entropies.encrypt", lambda payload: "0x" + "ab" * 32)
    monkeypatch.setattr(
        "services.entangled_ethical_entropies.get_live_oracle",
        lambda: SimpleNamespace(emit_event=lambda *args, **kwargs: {"tx_hash": "0x" + "cd" * 32}),
    )
    from services.entangled_ethical_entropies import EntangledEthicalEntropies

    engine = EntangledEthicalEntropies(MISSION_STATEMENT, shard_dim=4)
    intents = [
        {"wallet": "guardian::1", "gradient": 0.81, "consent": True},
        {"wallet": "guardian::2", "gradient": 0.79, "consent": True},
        {"wallet": "guardian::3", "gradient": 0.77, "consent": True},
    ]
    results = engine.diffuse_convictions_loop(intents, num_iters=1)
    assert results, "Diffusion results should not be empty"
    record = results[0]
    assert record["entropy"] > 0.7
    assert record["emergence"] is True
    assert isinstance(record["tx"], str)
    assert record["tx"].startswith("0x")
    assert len(record["tx"]) == 66

