"""Tests for the share_viz Flask endpoints."""

from __future__ import annotations

import json
from typing import Any

import pytest
import numpy as np

import services.share_viz_endpoint as share_module
from services.share_viz_endpoint import (
    MISSION_STATEMENT,
    PINNED_VIZ,
    STREAM_EMIT_QUEUE,
    _compute_zk_hash,
    _sign_guardian_vote,
    app,
    event_stream,
    LinearRegression,
    stream_viz_updates,
)


class DummyTelemetry:
    """Telemetry stub that records interactions for assertions."""

    def __init__(self, mission_anchor: str, *, consent: bool = True) -> None:  # noqa: D401
        self.mission_anchor = mission_anchor
        self.consent = consent
        self.results = None
        self.iteration = 0

    def end_to_end_test(self, num_iters: int = 6) -> list[dict[str, Any]]:
        return [
            {"wallet": f"0x{i}", "score": 0.5 + i * 0.1, "uplift": i * 0.01, "status": "attested"}
            for i in range(num_iters)
        ]

    def interactive_viz(self, results: list[dict[str, Any]]) -> None:
        self.results = results

    def fetch_mock_bio_data(self, user_wallet: str) -> dict[str, Any]:
        self.iteration += 1
        return {
            "wallet": user_wallet,
            "hrv": 0.88,
            "arousal": "steady",
            "timestamp": f"2024-01-01T00:00:0{self.iteration}Z",
        }

    def run_erv_simulation(self, bio_data: dict[str, Any]) -> tuple[float, str]:
        _ = bio_data
        return 0.81, "encrypted::dummy"

    def simulate_cascade(self, score: float, encrypted_res: str) -> bool:
        _ = encrypted_res
        return score >= 0.7


class StreamingTelemetry(DummyTelemetry):
    """Telemetry stub producing deterministic SSE attested cascades."""

    def __init__(self, mission_anchor: str, *, consent: bool = True) -> None:
        super().__init__(mission_anchor, consent=consent)
        self.iteration = 0

    def fetch_mock_bio_data(self, user_wallet: str) -> dict[str, Any]:
        self.iteration += 1
        return {
            "wallet": user_wallet,
            "hrv": 0.88,
            "arousal": "calm",
            "timestamp": f"2024-01-01T00:00:0{self.iteration}Z",
        }

    def run_erv_simulation(self, bio_data: dict[str, Any]) -> tuple[float, str]:
        _ = bio_data
        return 0.82, "encrypted::telemetry"

    def simulate_cascade(self, score: float, encrypted_res: str) -> bool:
        _ = encrypted_res
        return score > 0.7


@pytest.fixture(autouse=True)
def clear_state(monkeypatch: pytest.MonkeyPatch) -> None:
    """Reset in-memory state and patch telemetry for each test."""

    PINNED_VIZ.clear()
    STREAM_EMIT_QUEUE.clear()
    share_module.ADAPTIVE_COUNCIL_THRESHOLD = 2.0
    monkeypatch.setattr("services.share_viz_endpoint.TelemetryClass", DummyTelemetry)


def test_share_endpoint_creates_cid() -> None:
    """Sharing a viz returns CID metadata with zk hash."""

    test_client = app.test_client()
    payload = {
        "results": [{"wallet": "0xABC", "score": 0.88, "uplift": 0.2, "status": "attested"}],
        "mission_anchor": "Guardian Mission",
    }
    response = test_client.post(
        "/share_viz/0xABC",
        data=json.dumps(payload),
        headers={"Authorization": "Bearer signed-token", "Content-Type": "application/json"},
    )
    assert response.status_code == 200
    body = response.get_json()
    assert body["ipfs_cid"].startswith("Qm")
    assert len(body["zk_hash"]) == 64
    assert body["mission_statement"] == MISSION_STATEMENT

    record = PINNED_VIZ[body["ipfs_cid"]]
    expected_hash = _compute_zk_hash(payload["results"], "0xABC", record["auth_hash"])
    assert expected_hash == body["zk_hash"]


def test_attest_verification_detects_drift() -> None:
    """Attestation is blocked if the stored mission drifts from canonical."""

    cid = "Qm12345"
    PINNED_VIZ[cid] = {
        "wallet": "0xAAA",
        "mission_anchor": "Legacy Mission",
        "results": [],
        "zk_hash": "deadbeef",
        "auth_hash": "cafebabe",
        "artifact_path": "/tmp/mock",
        "viz_json": "{}",
    }

    test_client = app.test_client()
    response = test_client.get(f"/attest_viz/{cid}")
    assert response.status_code == 403
    assert b"mission_drift_detected" in response.data


def test_stream_endpoint_emits_sse(monkeypatch: pytest.MonkeyPatch) -> None:
    """SSE endpoint yields attested resonance updates with hashes."""

    monkeypatch.setattr("services.share_viz_endpoint.TelemetryClass", StreamingTelemetry)
    monkeypatch.setattr("services.share_viz_endpoint.time.sleep", lambda _: None)
    app.config["STREAM_LOOP_MAX"] = 1

    test_client = app.test_client()
    response = test_client.get(
        "/stream_viz/0xAAA",
        headers={"Authorization": "Bearer signed-token", "X-Consent": "true"},
    )

    assert response.status_code == 200
    assert response.mimetype == "text/event-stream"
    payload_line = response.data.decode("utf-8").strip().splitlines()[0]
    assert payload_line.startswith("data: ")

    payload = json.loads(payload_line[len("data: "):])
    assert payload["status"] == "attested"
    assert payload["mission_statement"] == MISSION_STATEMENT
    assert payload["guardian_sync"] == "resonance_update"
    assert len(payload["zk_hash"]) == 64
    assert payload["viz_update"].startswith("{")

    app.config.pop("STREAM_LOOP_MAX", None)


def _seed_viz_record(test_client) -> str:
    payload = {
        "results": [
            {"wallet": "0xAAA", "score": 0.82, "uplift": 0.3, "status": "attested"}
        ],
        "mission_anchor": MISSION_STATEMENT,
    }
    response = test_client.post(
        "/share_viz/0xAAA",
        data=json.dumps(payload),
        headers={"Authorization": "Bearer signed-token", "Content-Type": "application/json"},
    )
    body = response.get_json()
    return body["ipfs_cid"]


def test_council_consensus_met() -> None:
    """Guardian council attestation emits MPC consensus updates."""

    test_client = app.test_client()
    viz_cid = _seed_viz_record(test_client)

    votes = [
        {"guardian_id": "g1", "vote": True, "sig": _sign_guardian_vote("g1", True)},
        {"guardian_id": "g2", "vote": True, "sig": _sign_guardian_vote("g2", True)},
        {"guardian_id": "g3", "vote": False, "sig": _sign_guardian_vote("g3", False)},
    ]

    response = test_client.post(
        f"/guardian_council/{viz_cid}",
        data=json.dumps({"votes": votes, "threshold": 2}),
        headers={"Authorization": "Bearer guardian_token", "Content-Type": "application/json"},
    )

    assert response.status_code == 200
    body = response.get_json()
    assert body["consensus"] is True
    assert body["threshold_met"] is True
    assert "emit_id" in body

    emissions = list(stream_viz_updates())
    assert emissions
    emission = emissions[0]
    assert emission["guardian_sync"] == "council_vote"
    assert emission["consensus"] is True
    assert emission["uplift_adjust"] > 0
    assert emission["viz_cid"] == viz_cid
    assert len(emission["zk_pool_hash"]) == 64


def test_threshold_fail_returns_drift_alert() -> None:
    """Insufficient votes are rejected with a mission drift alert."""

    test_client = app.test_client()
    viz_cid = _seed_viz_record(test_client)

    votes = [
        {"guardian_id": "g1", "vote": False, "sig": _sign_guardian_vote("g1", False)},
        {"guardian_id": "g2", "vote": False, "sig": _sign_guardian_vote("g2", False)},
    ]

    response = test_client.post(
        f"/guardian_council/{viz_cid}",
        data=json.dumps({"votes": votes, "threshold": 3}),
        headers={"Authorization": "Bearer guardian_token", "Content-Type": "application/json"},
    )

    assert response.status_code == 402
    body = response.get_json()
    assert body["threshold_met"] is False
    assert body["alert"].startswith("guardian_drift")
    assert not list(stream_viz_updates())


def test_event_stream_handles_disconnect(monkeypatch: pytest.MonkeyPatch) -> None:
    """Closing the SSE generator performs a clean shutdown."""

    monkeypatch.setattr("services.share_viz_endpoint.time.sleep", lambda _: None)
    telemetry = StreamingTelemetry(MISSION_STATEMENT)
    gen = event_stream(
        "0xAAA",
        telemetry,
        MISSION_STATEMENT,
        "deadbeef",
        loop_max=1,
    )

    first_chunk = next(gen)
    assert first_chunk.startswith("data: ")
    gen.close()


def test_consensus_forecast_with_history(monkeypatch: pytest.MonkeyPatch) -> None:
    """Forecast endpoint produces uplift predictions and emits SSE cues."""

    test_client = app.test_client()
    viz_cid = _seed_viz_record(test_client)

    history = [
        {"score": 0.6, "consensus": True, "uplift": 0.9},
        {"score": 0.7, "consensus": True, "uplift": 1.1},
        {"score": 0.8, "consensus": True, "uplift": 1.3},
        {"score": 0.9, "consensus": True, "uplift": 1.5},
    ]

    monkeypatch.setattr(
        "services.share_viz_endpoint._load_guardian_vote_history",
        lambda cid, telemetry: history,
    )

    response = test_client.get(
        f"/consensus_forecast/{viz_cid}?resonance=0.82",
        headers={"Authorization": "Bearer guardian_token", "X-Consent": "true"},
    )

    assert response.status_code == 200
    body = response.get_json()

    scores = np.array([[entry["score"]] for entry in history], dtype=float)
    targets = np.array(
        [entry["uplift"] if entry["consensus"] else 0.0 for entry in history],
        dtype=float,
    )
    model = LinearRegression().fit(scores, targets)
    expected_pred = float(model.predict(np.array([[0.82]], dtype=float))[0])
    expected_conf = float(model.score(scores, targets))
    assert body["predicted_uplift"] == round(expected_pred, 4)
    assert body["confidence"] == round(max(0.0, min(expected_conf, 1.0)), 4)
    assert body["recommendation"] == "attest"
    assert len(body["aggregate_hash"]) == 64
    assert body["mission_statement"] == MISSION_STATEMENT
    assert "emit_id" in body

    emissions = list(stream_viz_updates())
    assert len(emissions) == 1
    emission = emissions[0]
    assert emission["guardian_sync"] == "consensus_forecast"
    assert emission["forecast"] == body["predicted_uplift"]
    assert emission["emit_id"] == body["emit_id"]
    assert emission["viz_cid"] == viz_cid


def test_consensus_forecast_without_history(monkeypatch: pytest.MonkeyPatch) -> None:
    """Forecast endpoint defaults to zero uplift when history is missing."""

    test_client = app.test_client()
    viz_cid = _seed_viz_record(test_client)

    monkeypatch.setattr(
        "services.share_viz_endpoint._load_guardian_vote_history",
        lambda cid, telemetry: [],
    )

    response = test_client.get(
        f"/consensus_forecast/{viz_cid}",
        headers={"Authorization": "Bearer guardian_token", "X-Consent": "true"},
    )

    assert response.status_code == 200
    body = response.get_json()
    assert body["predicted_uplift"] == 0.0
    assert body["confidence"] == 0.0
    assert body["recommendation"] == "insufficient_data"
    assert len(body["aggregate_hash"]) == 64
    assert body["mission_statement"] == MISSION_STATEMENT
    assert "emit_id" not in body
    assert not list(stream_viz_updates())


def test_adaptive_tune_high_conf() -> None:
    """High-confidence forecasts lower thresholds and emit adaptive updates."""

    test_client = app.test_client()
    viz_cid = _seed_viz_record(test_client)

    history_payload = [
        {"score": 0.82, "consensus": True},
        {"score": 0.78, "consensus": True},
        {"score": 0.65, "consensus": False},
    ]

    response = test_client.post(
        f"/adaptive_threshold/{viz_cid}",
        data=json.dumps({"forecast_conf": 0.91, "historical_votes": history_payload}),
        headers={"Authorization": "Bearer guardian_token", "Content-Type": "application/json"},
    )

    assert response.status_code == 200
    body = response.get_json()
    assert body["new_threshold"] <= 1.5
    assert body["impact"] == "accelerated"
    assert 0.0 <= body["tune_conf"] <= 1.0
    assert "history_hash" in body
    assert body["emit_id"]
    assert share_module.ADAPTIVE_COUNCIL_THRESHOLD == body["new_threshold"]

    emissions = list(stream_viz_updates())
    assert emissions
    emission = emissions[0]
    assert emission["guardian_sync"] == "adaptive_threshold"
    assert emission["adaptive_threshold"] == body["new_threshold"]
    assert emission["viz_cid"] == viz_cid
    assert emission["emit_id"] == body["emit_id"]


def test_adaptive_tune_low_conf_default() -> None:
    """Low-confidence forecasts keep conservative thresholds with review cue."""

    test_client = app.test_client()
    viz_cid = _seed_viz_record(test_client)

    response = test_client.post(
        f"/adaptive_threshold/{viz_cid}",
        data=json.dumps({"forecast_conf": 0.2}),
        headers={"Authorization": "Bearer guardian_token", "Content-Type": "application/json"},
    )

    assert response.status_code == 200
    body = response.get_json()
    assert body["new_threshold"] == 2.0
    assert body["impact"] == "review_recommended"
    assert "message" in body and body["message"].startswith("review_recommended")
    assert body["tune_conf"] == 0.0
    assert share_module.ADAPTIVE_COUNCIL_THRESHOLD == 2.0

    emissions = list(stream_viz_updates())
    assert emissions
    emission = emissions[0]
    assert emission["guardian_sync"] == "adaptive_threshold"
    assert emission["adaptive_threshold"] == 2.0
    assert emission["viz_cid"] == viz_cid
