"""Tests for the Entangled Ethical Entropies (E3) diffusion module."""

from __future__ import annotations

import sys
import types
from types import SimpleNamespace

import numpy as np
import pytest

if "requests" not in sys.modules:
    requests_stub = types.ModuleType("requests")
    requests_stub.get = lambda *args, **kwargs: SimpleNamespace(status_code=200, json=lambda: {})
    requests_stub.post = lambda *args, **kwargs: SimpleNamespace(status_code=200, json=lambda: {})
    sys.modules["requests"] = requests_stub

if "cryptography" not in sys.modules:
    cryptography_stub = types.ModuleType("cryptography")
    hazmat_stub = types.ModuleType("cryptography.hazmat")
    primitives_stub = types.ModuleType("cryptography.hazmat.primitives")
    ciphers_stub = types.ModuleType("cryptography.hazmat.primitives.ciphers")
    aead_stub = types.ModuleType("cryptography.hazmat.primitives.ciphers.aead")

    class _AESGCM:
        def __init__(self, *_: object, **__: object) -> None:
            pass

        def encrypt(self, *_: object, **__: object) -> bytes:
            return b""

        def decrypt(self, *_: object, **__: object) -> bytes:
            return b""

    aead_stub.AESGCM = _AESGCM
    ciphers_stub.aead = aead_stub
    primitives_stub.ciphers = ciphers_stub
    hazmat_stub.primitives = primitives_stub
    cryptography_stub.hazmat = hazmat_stub

    sys.modules["cryptography"] = cryptography_stub
    sys.modules["cryptography.hazmat"] = hazmat_stub
    sys.modules["cryptography.hazmat.primitives"] = primitives_stub
    sys.modules["cryptography.hazmat.primitives.ciphers"] = ciphers_stub
    sys.modules["cryptography.hazmat.primitives.ciphers.aead"] = aead_stub

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
            return {
                "alpha_power": 0.92,
                "alpha_wave": 0.92,
                "theta_intent": "align",
                "theta": "align",
                "wallet": wallet,
            }

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


def test_comet_attractor_high_entropy(monkeypatch):
    """Comet conjunction mode should surface covenant jest alignments above entropy 0.99."""

    proofs: dict[str, list[str]] = {}

    def fake_proof(payload):
        proofs.setdefault("payloads", []).append(str(payload))
        return "zk_valid"

    monkeypatch.setattr("services.entangled_ethical_entropies.generate_proof", fake_proof)
    monkeypatch.setattr("services.entangled_ethical_entropies.encrypt", lambda payload: "0x" + "ef" * 32)
    monkeypatch.setattr(
        "services.entangled_ethical_entropies.get_live_oracle",
        lambda: SimpleNamespace(emit_event=lambda *args, **kwargs: {"tx_hash": "0x" + "be" * 32}),
    )
    from services.entangled_ethical_entropies import EntangledEthicalEntropies

    engine = EntangledEthicalEntropies(MISSION_STATEMENT, shard_dim=4, comet_mode=True)
    intents = [
        {"wallet": "guardian::alpha", "gradient": 0.88, "consent": True, "theta": "align"},
        {"wallet": "guardian::beta", "gradient": 0.9, "consent": True, "theta": "align"},
    ]
    results = engine.diffuse_convictions_loop(intents, num_iters=1)
    assert results, "Comet diffusion should yield telemetry"
    record = results[0]
    assert record["alignment"] is True
    assert record["comet_entropy"] is not None and record["comet_entropy"] > 0.99
    payloads = proofs.get("payloads", [])
    assert any("ni_fe" in item for item in payloads)

