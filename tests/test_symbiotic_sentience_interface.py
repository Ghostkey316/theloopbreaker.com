from __future__ import annotations

from datetime import datetime

import numpy as np
import pytest

import services.symbiotic_sentience_interface as ssi
from services.symbiotic_sentience_interface import SymbioticSentienceInterface
from vaultfire.protocol.constants import MISSION_STATEMENT


def test_capture_neural_intent_generates_proof(monkeypatch):
    interface = SymbioticSentienceInterface(MISSION_STATEMENT)

    class DummyRaw:
        def get_data(self) -> np.ndarray:  # noqa: D401
            return np.ones((1, 64)) * 11.0

    dummy_raw = DummyRaw()
    monkeypatch.setattr(ssi.mne.io, "read_raw", lambda *args, **kwargs: dummy_raw)

    intent = interface.capture_neural_intent("0xabc123")

    assert 0.0 <= intent["alpha_power"] <= 1.0
    assert intent["theta_intent"] == "align"
    assert isinstance(intent["timestamp"], datetime)
    assert len(intent["proof"]) >= 32
    assert intent["neural_hash"]
    assert intent["wallet_hash"]


def test_co_evolve_align_boost():
    interface = SymbioticSentienceInterface(MISSION_STATEMENT)

    intent = {
        "alpha_power": 0.8,
        "theta_intent": "align",
        "wallet_hash": "hash",
        "neural_hash": "hash",
    }
    current = 0.3

    new_gradient = interface.co_evolve_moral_gradient(intent, current)

    assert new_gradient > current
    assert 0.0 <= new_gradient <= 1.0


def test_forge_neural_covenant_emits_tx():
    interface = SymbioticSentienceInterface(MISSION_STATEMENT)
    events: list[dict[str, object]] = []
    interface.bind_stream_emitter(events.append)

    class DummyOracle:
        sandbox_tx = "0x" + "0" * 64

        def emit_event(self, *args, **kwargs) -> dict[str, str]:  # noqa: D401
            _ = (args, kwargs)
            return {"tx_hash": "0x" + "a" * 64}

    interface._live_oracle = DummyOracle()  # noqa: SLF001 - test instrumentation

    tx_hash = interface.forge_neural_covenant(0.7, "proofhash")

    assert tx_hash == "0x" + "a" * 64
    assert events
    event = events[0]
    assert event["payload"]["tx_hash"] == tx_hash
    assert event["payload"]["tuned_gradient"] == pytest.approx(0.7)
