"""Tests for the upgraded MissionResonanceEngine safeguards."""

from __future__ import annotations

import pytest

from vaultfire.protocol import mission_resonance
from vaultfire.protocol.mission_resonance import (
    ConfidentialComputeAttestor,
    MissionResonanceEngine,
)


def _make_attestor() -> ConfidentialComputeAttestor:
    return ConfidentialComputeAttestor(
        accepted_measurements={"enclave-alpha": "m-123", "enclave-beta": "m-456"}
    )


def test_confidential_signal_requires_verified_attestation() -> None:
    engine = MissionResonanceEngine(confidential_attestor=_make_attestor())

    signal = engine.ingest_signal(
        source="edge-node-1",
        technique="confidential-ml",
        score=0.91,
        metadata={"enclave_id": "enclave-alpha", "measurement": "m-123"},
    )

    assert signal.technique == "confidential-ml"

    with pytest.raises(PermissionError):
        engine.ingest_signal(
            source="edge-node-1",
            technique="confidential-ml",
            score=0.88,
            metadata={"enclave_id": "enclave-alpha", "measurement": "invalid"},
        )


def test_integrity_report_exposes_breakdown_and_attested_enclaves() -> None:
    attestor = _make_attestor()
    engine = MissionResonanceEngine(confidential_attestor=attestor)

    engine.ingest_signal(
        source="edge-node-1",
        technique="confidential-ml",
        score=0.92,
        metadata={"enclave_id": "enclave-alpha", "measurement": "m-123"},
    )
    engine.ingest_signal(source="cohort", technique="edge-llm", score=0.75)

    report = engine.integrity_report()

    assert report["technique_breakdown"]["confidential-ml"]["count"] == 1
    assert report["technique_breakdown"]["edge-llm"]["avg_score"] == 0.75
    assert report["attested_enclaves"] == {"enclave-alpha": "verified", "enclave-beta": "verified"}


def test_resonance_gradient_uses_recent_window(monkeypatch: pytest.MonkeyPatch) -> None:
    attestor = _make_attestor()
    engine = MissionResonanceEngine(confidential_attestor=attestor)

    clock = {"now": 1_000_000.0}

    def fake_time() -> float:
        return clock["now"]

    monkeypatch.setattr(mission_resonance.time, "time", fake_time)

    engine.ingest_signal(
        source="historical",
        technique="edge-llm",
        score=0.5,
    )

    clock["now"] += 7200  # 2 hours later, outside of default gradient window

    engine.ingest_signal(
        source="recent",
        technique="confidential-ml",
        score=0.9,
        metadata={"enclave_id": "enclave-beta", "measurement": "m-456"},
    )

    gradient = engine.resonance_gradient(window_seconds=3600)

    assert gradient == pytest.approx(0.4, abs=1e-6)


def test_resonance_gradient_requires_positive_window() -> None:
    engine = MissionResonanceEngine()

    with pytest.raises(ValueError):
        engine.resonance_gradient(window_seconds=0)
