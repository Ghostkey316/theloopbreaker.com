"""Tests for the upgraded MissionResonanceEngine safeguards."""

from __future__ import annotations

import asyncio
import time
from typing import Any, Sequence, cast

import pytest

try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM  # type: ignore  # noqa: F401
    from cryptography.exceptions import InvalidTag  # type: ignore  # noqa: F401
except (ImportError, ModuleNotFoundError):  # pragma: no cover - environment without optional deps
    CRYPTOGRAPHY_AVAILABLE = False
else:  # pragma: no cover - ensures import works when installed
    CRYPTOGRAPHY_AVAILABLE = True

if CRYPTOGRAPHY_AVAILABLE:
    from vaultfire.protocol import mission_resonance
    from vaultfire.protocol.mission_resonance import (
        ConfidentialComputeAttestor,
        MissionResonanceEngine,
    )
else:  # pragma: no cover - executed only when optional deps missing
    mission_resonance = cast(Any, None)
    ConfidentialComputeAttestor = cast(Any, None)
    MissionResonanceEngine = cast(Any, None)


def _make_attestor() -> ConfidentialComputeAttestor:
    return ConfidentialComputeAttestor(
        accepted_measurements={"enclave-alpha": "m-123", "enclave-beta": "m-456"}
    )


@pytest.mark.skipif(
    not CRYPTOGRAPHY_AVAILABLE,
    reason="[optional] cryptography is required for mission resonance tests",
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


@pytest.mark.skipif(
    not CRYPTOGRAPHY_AVAILABLE,
    reason="[optional] cryptography is required for mission resonance tests",
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
    assert report["gradient_window_seconds"] == engine.gradient_window_seconds
    assert "confidential-ml" in report["gradient_breakdown"]


@pytest.mark.skipif(
    not CRYPTOGRAPHY_AVAILABLE,
    reason="[optional] cryptography is required for mission resonance tests",
)
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


@pytest.mark.skipif(
    not CRYPTOGRAPHY_AVAILABLE,
    reason="[optional] cryptography is required for mission resonance tests",
)
def test_resonance_gradient_requires_positive_window() -> None:
    engine = MissionResonanceEngine()

    with pytest.raises(ValueError):
        engine.resonance_gradient(window_seconds=0)


@pytest.mark.skipif(
    not CRYPTOGRAPHY_AVAILABLE,
    reason="[optional] cryptography is required for mission resonance tests",
)
def test_technique_gradients_track_recent_and_historical(monkeypatch: pytest.MonkeyPatch) -> None:
    attestor = _make_attestor()
    engine = MissionResonanceEngine(confidential_attestor=attestor)

    clock = {"now": 1_000_000.0}

    def fake_time() -> float:
        return clock["now"]

    monkeypatch.setattr(mission_resonance.time, "time", fake_time)

    engine.ingest_signal(source="historical-edge", technique="edge-llm", score=0.4)
    engine.ingest_signal(
        source="historical-confidential",
        technique="confidential-ml",
        score=0.5,
        metadata={"enclave_id": "enclave-alpha", "measurement": "m-123"},
    )

    clock["now"] += 4000

    engine.ingest_signal(source="recent-edge", technique="edge-llm", score=0.9)
    engine.ingest_signal(
        source="recent-confidential",
        technique="confidential-ml",
        score=0.7,
        metadata={"enclave_id": "enclave-beta", "measurement": "m-456"},
    )

    gradients = engine.technique_gradients(window_seconds=3600)

    assert gradients["edge-llm"]["recent_avg"] == pytest.approx(0.9, abs=1e-6)
    assert gradients["edge-llm"]["historical_avg"] == pytest.approx(0.4, abs=1e-6)
    assert gradients["edge-llm"]["gradient"] == pytest.approx(0.5, abs=1e-6)

    assert gradients["confidential-ml"]["recent_avg"] == pytest.approx(0.7, abs=1e-6)
    assert gradients["confidential-ml"]["historical_avg"] == pytest.approx(0.5, abs=1e-6)
    assert gradients["confidential-ml"]["gradient"] == pytest.approx(0.2, abs=1e-6)


@pytest.mark.skipif(
    not CRYPTOGRAPHY_AVAILABLE,
    reason="[optional] cryptography is required for mission resonance tests",
)
@pytest.mark.asyncio
async def test_resonance_batch_latency() -> None:
    engine = MissionResonanceEngine()

    for index in range(256):
        engine.ingest_signal(
            source=f"edge-{index}",
            technique="edge-llm",
            score=0.62,
        )
    for index in range(256, 512):
        engine.ingest_signal(
            source=f"mpc-{index}",
            technique="mpc-fabric",
            score=0.48,
        )

    async def zk_stub(scores: Sequence[float]) -> None:
        await asyncio.sleep(0)

    start = time.perf_counter()
    score = await engine.compute_resonance_score(batch_size=64, zk_redactor=zk_stub)
    elapsed = time.perf_counter() - start

    assert pytest.approx(0.55, abs=1e-6) == score
    assert elapsed < 5
