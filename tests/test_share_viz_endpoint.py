"""Tests for the share_viz Flask endpoints."""

from __future__ import annotations

import json
import time
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


class OracleHighTelemetry(DummyTelemetry):
    """Telemetry stub producing high empathy resonance values."""

    guardian_pool_template = [
        {"guardian_id": "g1", "hrv": 0.91, "arousal": "calm", "score": 0.88},
        {"guardian_id": "g2", "hrv": 0.9, "arousal": "steady", "score": 0.9},
        {"guardian_id": "g3", "hrv": 0.89, "arousal": "focused", "score": 0.87},
        {"guardian_id": "g4", "hrv": 0.92, "arousal": "calm", "score": 0.91},
    ]

    def __init__(self, mission_anchor: str, *, consent: bool = True) -> None:
        super().__init__(mission_anchor, consent=consent)
        self.guardian_pool = [dict(entry) for entry in self.guardian_pool_template]

    def fetch_mock_bio_data(self, user_wallet: str) -> dict[str, Any]:
        template = next(
            (entry for entry in self.guardian_pool if entry["guardian_id"] == user_wallet),
            {"hrv": 0.88, "arousal": "steady"},
        )
        return {
            "wallet": user_wallet,
            "guardian_id": user_wallet,
            "hrv": template.get("hrv", 0.88),
            "arousal": template.get("arousal", "steady"),
            "timestamp": "2024-01-01T00:00:00Z",
        }

    def run_erv_simulation(self, bio_data: dict[str, Any]) -> tuple[float, str]:
        template = next(
            (entry for entry in self.guardian_pool if entry["guardian_id"] == bio_data.get("guardian_id")),
            None,
        )
        score = template.get("score", 0.85) if template else 0.8
        return score, "encrypted::oracle"

    def simulate_cascade(self, score: float, encrypted_res: str) -> bool:
        _ = encrypted_res
        return score >= 0.75


class OracleSilentTelemetry(DummyTelemetry):
    """Telemetry stub that withholds contributions due to lack of consent."""

    def __init__(self, mission_anchor: str, *, consent: bool = True) -> None:
        super().__init__(mission_anchor, consent=consent)
        self.guardian_pool = [{"guardian_id": "g-silent", "consent": False, "hrv": 0.8}]

    def fetch_mock_bio_data(self, user_wallet: str) -> dict[str, Any]:
        return {
            "wallet": user_wallet,
            "guardian_id": user_wallet,
            "hrv": 0.8,
            "arousal": "neutral",
            "timestamp": "2024-01-01T00:00:00Z",
        }

    def run_erv_simulation(self, bio_data: dict[str, Any]) -> tuple[float, str]:
        _ = bio_data
        return 0.6, "encrypted::silent"

    def simulate_cascade(self, score: float, encrypted_res: str) -> bool:
        _ = (score, encrypted_res)
        return False


class TemporalWeaveTelemetry(DummyTelemetry):
    """Deterministic telemetry for temporal weave predictions."""

    def __init__(self, mission_anchor: str, *, consent: bool = True) -> None:
        super().__init__(mission_anchor, consent=consent)
        self._series = [0.55 + 0.01 * idx for idx in range(40)]

    def fetch_mock_bio_data(self, user_wallet: str) -> dict[str, Any]:
        data = super().fetch_mock_bio_data(user_wallet)
        data["timestamp"] = f"2024-01-01T00:{self.iteration:02d}:00Z"
        return data

    def run_erv_simulation(self, bio_data: dict[str, Any]) -> tuple[float, str]:
        index = max(0, min(len(self._series) - 1, self.iteration - 1))
        return self._series[index], "encrypted::temporal"


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


def test_oracle_high_avg(monkeypatch: pytest.MonkeyPatch) -> None:
    """Collective empathy oracle aggregates high ERV resonance."""

    monkeypatch.setattr("services.share_viz_endpoint.TelemetryClass", OracleHighTelemetry)
    test_client = app.test_client()
    PINNED_VIZ["cid-high"] = {"mission_statement": MISSION_STATEMENT}

    response = test_client.get(
        "/collective_empathy_oracle/cid-high",
        headers={"Authorization": "Bearer guardian_token"},
    )

    assert response.status_code == 200
    body = response.get_json()
    assert body["contributors"] == len(OracleHighTelemetry.guardian_pool_template)
    assert body["collective_score"] > 0.8
    assert body["empathy_baseline"] == "high"

    assert STREAM_EMIT_QUEUE
    event = STREAM_EMIT_QUEUE[-1]
    assert event["guardian_sync"] == "collective_empathy"
    assert pytest.approx(event["collective_empathy"], rel=1e-3) == pytest.approx(
        body["collective_score"], rel=1e-3
    )


def test_no_contributors_default(monkeypatch: pytest.MonkeyPatch) -> None:
    """Oracle defaults to awaiting state when no consented guardians."""

    monkeypatch.setattr("services.share_viz_endpoint.TelemetryClass", OracleSilentTelemetry)
    test_client = app.test_client()

    response = test_client.get(
        "/collective_empathy_oracle/absent",
        headers={"Authorization": "Bearer guardian_token"},
    )

    assert response.status_code == 200
    body = response.get_json()
    assert body == {
        "collective_score": 0.5,
        "empathy_baseline": "awaiting_council",
        "contributors": 0,
    }
    assert not STREAM_EMIT_QUEUE


def test_echo_detector_low_diversity(monkeypatch: pytest.MonkeyPatch) -> None:
    """Low diversity gradients trigger echo chamber alerts and emissions."""

    dispatch_calls: list[tuple[str, str]] = []

    def record_dispatch(cid: str, zk_hash: str) -> None:
        dispatch_calls.append((cid, zk_hash))

    monkeypatch.setattr(
        "services.share_viz_endpoint.dispatch_to_base_oracle", record_dispatch
    )

    test_client = app.test_client()
    viz_cid = "echo-low"
    PINNED_VIZ[viz_cid] = {
        "wallet": "0xECHO",
        "mission_anchor": MISSION_STATEMENT,
        "results": [{"score": 0.8}],
        "auth_hash": "auth::hash",
        "last_hybrid_score": 0.78,
    }

    payload = {
        "vote_graph": {
            "nodes": [
                {"guardian_id": "g1", "gradient": 0.8},
                {"guardian_id": "g2", "gradient": 0.81},
                {"guardian_id": "g3", "gradient": 0.79},
            ],
            "edges": [["g1", "g2"], ["g2", "g3"], ["g1", "g3"]],
        }
    }

    response = test_client.post(
        f"/echo_chamber_detector/{viz_cid}",
        data=json.dumps(payload),
        headers={"Authorization": "Bearer guardian_token", "Content-Type": "application/json"},
    )

    assert response.status_code == 200
    body = response.get_json()
    assert body["echo_alert"] is True
    assert body["homogeneity_score"] < 0.3
    assert "diversify" in body["diversity_recommendation"]
    assert "protect" in body["diversity_recommendation"]
    assert len(body["zk_graph_hash"]) == 64
    assert dispatch_calls
    assert dispatch_calls[0][0] == viz_cid
    assert dispatch_calls[0][1] == body["zk_graph_hash"]

    emissions = list(stream_viz_updates())
    assert emissions
    emission = emissions[0]
    assert emission["echo_alert"] is True
    assert emission["score"] == body["homogeneity_score"]
    assert emission["emit_id"] == body["emit_id"]


def test_echo_detector_balanced_graph(monkeypatch: pytest.MonkeyPatch) -> None:
    """Diverse guardian gradients avoid echo chamber alerts."""

    dispatch_calls: list[tuple[str, str]] = []

    def record_dispatch(cid: str, zk_hash: str) -> None:
        dispatch_calls.append((cid, zk_hash))

    monkeypatch.setattr(
        "services.share_viz_endpoint.dispatch_to_base_oracle", record_dispatch
    )

    test_client = app.test_client()
    viz_cid = "echo-balanced"
    PINNED_VIZ[viz_cid] = {
        "wallet": "0xSAFE",
        "mission_anchor": MISSION_STATEMENT,
        "results": [
            {"score": 0.25},
            {"score": 0.55},
            {"score": 0.9},
        ],
        "auth_hash": "auth::hash",
    }

    payload = {
        "vote_graph": {
            "nodes": [
                {"guardian_id": "g1", "gradient": 0.2},
                {"guardian_id": "g2", "gradient": 0.6},
                {"guardian_id": "g3", "gradient": 0.92},
            ],
            "edges": [["g1", "g2"], ["g2", "g3"]],
        },
        "diversity_threshold": 0.2,
    }

    response = test_client.post(
        f"/echo_chamber_detector/{viz_cid}",
        data=json.dumps(payload),
        headers={"Authorization": "Bearer guardian_token", "Content-Type": "application/json"},
    )

    assert response.status_code == 200
    body = response.get_json()
    assert body["echo_alert"] is False
    assert body["homogeneity_score"] >= 0.2
    assert "balanced" in body["diversity_recommendation"]
    assert "protect" in body["diversity_recommendation"]
    assert len(body["zk_graph_hash"]) == 64
    assert not dispatch_calls
    assert not STREAM_EMIT_QUEUE

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


def test_tracker_alert_drift(monkeypatch: pytest.MonkeyPatch) -> None:
    """Belief tracker flags drift and emits guardian alerts."""

    test_client = app.test_client()
    viz_cid = _seed_viz_record(test_client)

    values = np.linspace(0.6, 0.9, 20)

    class DummySeries(list):
        def __init__(self, data):
            super().__init__(data)
            self.index = list(range(len(data)))

        @property
        def values(self):
            return np.asarray(self, dtype=float)

    class StubARIMA:
        def __init__(self, data, order):
            self._data = np.asarray(data, dtype=float)

        def fit(self):
            data = self._data

            class _Result:
                def __init__(self, arr: np.ndarray):
                    self._arr = arr
                    self.fittedvalues = arr + 0.2

                def forecast(self, steps: int):
                    return np.linspace(self._arr[-1], self._arr[-1] + 0.1, steps)

            return _Result(data)

    monkeypatch.setattr(
        "services.share_viz_endpoint._collect_resonance_series", lambda telemetry, wallet_id: DummySeries(values)
    )
    monkeypatch.setattr("services.share_viz_endpoint.ARIMA", StubARIMA)

    response = test_client.get(
        f"/belief_evolution_tracker/{viz_cid}",
        headers={"Authorization": "Bearer guardian_token", "X-Consent": "true"},
    )

    assert response.status_code == 200
    body = response.get_json()
    assert body["alert"] is True
    assert body["drift_score"] > 0.1
    assert "protect" in body["recommendation"].lower() or MISSION_STATEMENT.lower() in body["recommendation"].lower()
    assert len(body["predicted_trend"]) == 5
    emissions = list(STREAM_EMIT_QUEUE)
    assert any(event.get("drift_alert") for event in emissions)


def test_tracker_short_history_default(monkeypatch: pytest.MonkeyPatch) -> None:
    """Belief tracker returns default when insufficient resonance data."""

    test_client = app.test_client()
    viz_cid = _seed_viz_record(test_client)

    class DummySeries(list):
        def __init__(self):
            super().__init__([0.7, 0.71])
            self.index = [0, 1]

        @property
        def values(self):
            return np.asarray(self, dtype=float)

    monkeypatch.setattr(
        "services.share_viz_endpoint._collect_resonance_series", lambda telemetry, wallet_id: DummySeries()
    )

    response = test_client.get(
        f"/belief_evolution_tracker/{viz_cid}",
        headers={"Authorization": "Bearer guardian_token", "X-Consent": "true"},
    )

    assert response.status_code == 200
    body = response.get_json()
    assert body["insufficient_data"] is True
    assert body["alert"] is False
    assert body["drift_score"] == 0.0


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


def test_quantum_resist_upgrade_success(monkeypatch: pytest.MonkeyPatch) -> None:
    """PQ rotation upgrades to Falcon keys and emits guardian notifications."""

    viz_cid = "cid-quantum"
    PINNED_VIZ[viz_cid] = {
        "wallet": "0xFAL",
        "mission_anchor": MISSION_STATEMENT,
        "results": [{"score": 0.88, "uplift": 0.22}, {"score": 0.77, "uplift": 0.18}],
        "auth_hash": "auth::hash",
        "legacy_sig": "dilithium::legacy",
        "current_sig_type": "dilithium",
    }

    class DummyFalconKey:
        def public_key(self) -> "DummyFalconKey":  # noqa: D401
            return self

        def public_bytes(self, *_: Any, **__: Any) -> bytes:
            return b"falcon-pub"

    def generate_key() -> DummyFalconKey:
        generate_key.called = True
        return DummyFalconKey()

    generate_key.called = False  # type: ignore[attr-defined]

    transition_calls: dict[str, Any] = {}

    def verify_transition(legacy: Any, new_key: Any) -> bool:
        transition_calls["args"] = (legacy, new_key)
        return True

    monkeypatch.setattr(share_module.falcon, "generate_private_key", generate_key, raising=False)
    monkeypatch.setattr(share_module.dilithium, "verify_transition", verify_transition, raising=False)

    test_client = app.test_client()
    response = test_client.post(
        f"/quantum_resist_upgrade/{viz_cid}",
        data=json.dumps(
            {
                "current_sig_type": "dilithium",
                "target_sig_type": "falcon",
                "chain_id": "chain-A",
            }
        ),
        headers={"Authorization": "Bearer guardian_token", "Content-Type": "application/json"},
    )

    assert response.status_code == 200
    body = response.get_json()
    assert body["status"] == "upgraded"
    assert body["new_pubkey"] == b"falcon-pub".hex()
    assert len(body["rotation_hash"]) == 64
    assert "safeguard" in body["status_detail"]
    assert generate_key.called  # type: ignore[attr-defined]
    assert transition_calls["args"][0] == "dilithium::legacy"

    record = PINNED_VIZ[viz_cid]
    assert record["current_sig_type"] == "falcon"
    assert record["rotation_chain"]
    assert record["rotation_zk_proof"]
    assert record["belief_evolution"][0]["sig_type"] == "falcon"

    emissions = list(stream_viz_updates())
    assert emissions
    emission = emissions[0]
    assert emission["pq_upgrade"] is True
    assert emission["new_sig_type"] == "falcon"
    assert emission["viz_cid"] == viz_cid
    assert emission["emit_id"] == body["emit_id"]


def test_quantum_resist_upgrade_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    """PQ rotation failure surfaces 500 response without guardian emit."""

    viz_cid = "cid-fail"
    PINNED_VIZ[viz_cid] = {
        "wallet": "0xERR",
        "mission_anchor": MISSION_STATEMENT,
        "results": [{"score": 0.66, "uplift": 0.12}],
        "auth_hash": "auth::hash",
        "legacy_sig": "dilithium::legacy",
        "current_sig_type": "dilithium",
    }

    def raise_error() -> None:
        raise RuntimeError("keygen_failure")

    monkeypatch.setattr(share_module.falcon, "generate_private_key", raise_error, raising=False)

    test_client = app.test_client()
    response = test_client.post(
        f"/quantum_resist_upgrade/{viz_cid}",
        data=json.dumps(
            {
                "current_sig_type": "dilithium",
                "target_sig_type": "falcon",
                "chain_id": "chain-B",
            }
        ),
        headers={"Authorization": "Bearer guardian_token", "Content-Type": "application/json"},
    )

    assert response.status_code == 500
    body = response.get_json()
    assert body == {"status": "rotation_failed"}
    assert not STREAM_EMIT_QUEUE
    assert PINNED_VIZ[viz_cid]["current_sig_type"] == "dilithium"
    assert "belief_evolution" not in PINNED_VIZ[viz_cid]


def test_conviction_contagion_high_spread_alert(monkeypatch: pytest.MonkeyPatch) -> None:
    """High resonance and low diversity trigger contagion alerts and emissions."""

    test_client = app.test_client()
    viz_cid = _seed_viz_record(test_client)

    record = PINNED_VIZ[viz_cid]
    record["results"] = [
        {"wallet": "0xAAA", "score": 0.91, "uplift": 0.18},
        {"wallet": "0xBBB", "score": 0.88, "uplift": 0.21},
        {"wallet": "0xCCC", "score": 0.9, "uplift": 0.2},
    ]
    record["echo_cache"] = {"homogeneity_score": 0.2, "timestamp": time.time()}

    payload = {
        "network_graph": {"nodes": 42, "beta": 0.7, "gamma": 0.05},
        "initial_infected": 0.25,
    }
    response = test_client.post(
        f"/conviction_contagion_model/{viz_cid}",
        data=json.dumps(payload),
        headers={"Authorization": "Bearer guardian_token", "Content-Type": "application/json"},
    )

    assert response.status_code == 200
    body = response.get_json()
    assert body["contagion_alert"] is True
    assert body["spread_recommendation"] == "accelerate"
    assert body["mission_statement"] == MISSION_STATEMENT
    assert len(body["zk_contagion_hash"]) == 64

    emissions = list(stream_viz_updates())
    assert emissions
    emission = emissions[0]
    assert emission["contagion_alert"] is True
    assert pytest.approx(emission["peak"], rel=1e-3) == pytest.approx(body["peak_infection"], rel=1e-3)
    assert emission["viz_cid"] == viz_cid

    cache = PINNED_VIZ[viz_cid]["conviction_cache"]
    assert cache["beta_effective"] >= payload["network_graph"]["beta"]
    assert cache["resonance_gradient"] > 0.8


def test_conviction_contagion_low_adoption(monkeypatch: pytest.MonkeyPatch) -> None:
    """Low beta scenarios stay contained without emitting contagion alerts."""

    test_client = app.test_client()
    viz_cid = _seed_viz_record(test_client)

    record = PINNED_VIZ[viz_cid]
    record["results"] = [
        {"wallet": "0xAAA", "score": 0.42, "uplift": 0.05},
        {"wallet": "0xBBB", "score": 0.38, "uplift": 0.04},
    ]
    record["echo_cache"] = {"homogeneity_score": 0.9, "timestamp": time.time()}

    payload = {
        "network_graph": {"nodes": 16, "beta": 0.15, "gamma": 0.35},
        "initial_infected": 0.1,
    }
    response = test_client.post(
        f"/conviction_contagion_model/{viz_cid}",
        data=json.dumps(payload),
        headers={"Authorization": "Bearer guardian_token", "Content-Type": "application/json"},
    )

    assert response.status_code == 200
    body = response.get_json()
    assert body["contagion_alert"] is False
    assert body["spread_recommendation"] == "contain"
    detail = body["recommendation_detail"].lower()
    assert any(term in detail for term in {"protect", "safeguard"})
    assert len(body["zk_contagion_hash"]) == 64
    assert list(stream_viz_updates()) == []


def test_temporal_resonance_weave_high_conf(monkeypatch: pytest.MonkeyPatch) -> None:
    """Temporal weave returns predictions and emits when confidence is high."""

    viz_cid = "weave-high"
    PINNED_VIZ[viz_cid] = {
        "wallet": "0xAAA",
        "mission_anchor": MISSION_STATEMENT,
        "auth_hash": "auth::hash",
        "belief_evolution": [
            {"timestamp": idx, "score": 0.55 + 0.01 * idx}
            for idx in range(20)
        ],
    }

    monkeypatch.setattr(
        "services.share_viz_endpoint.TelemetryClass",
        TemporalWeaveTelemetry,
    )

    test_client = app.test_client()
    response = test_client.get(
        f"/temporal_resonance_weave/{viz_cid}",
        headers={"Authorization": "Bearer guardian_token"},
    )

    assert response.status_code == 200
    body = response.get_json()
    assert len(body["predicted_trend"]) == 5
    assert body["weave_conf"] > 0.0
    assert "empathy" in body["correlation_scores"]

    if body["weave_conf"] > 0.7:
        assert STREAM_EMIT_QUEUE
        emission = STREAM_EMIT_QUEUE[-1]
        assert emission["temporal_weave"] is True
        assert emission["trend_forecast"] == body["predicted_trend"]


def test_temporal_resonance_weave_short_series(monkeypatch: pytest.MonkeyPatch) -> None:
    """Temporal weave returns default payload when history is insufficient."""

    viz_cid = "weave-short"
    PINNED_VIZ[viz_cid] = {
        "wallet": "0xBBB",
        "mission_anchor": MISSION_STATEMENT,
        "auth_hash": "auth::hash",
        "belief_evolution": [{"timestamp": 0, "score": 0.51}],
    }

    monkeypatch.setattr(
        "services.share_viz_endpoint.TelemetryClass",
        TemporalWeaveTelemetry,
    )

    test_client = app.test_client()
    response = test_client.get(
        f"/temporal_resonance_weave/{viz_cid}",
        headers={"Authorization": "Bearer guardian_token"},
    )

    assert response.status_code == 200
    body = response.get_json()
    assert body == {"weave_conf": 0.0, "insufficient_history": True}
    assert not STREAM_EMIT_QUEUE


def test_narrative_neutral_text(monkeypatch: pytest.MonkeyPatch) -> None:
    """Narrative audit returns neutral classification and zk hash."""

    viz_cid = "narrative-neutral"
    PINNED_VIZ[viz_cid] = {
        "wallet": "0xAAA",
        "mission_anchor": MISSION_STATEMENT,
        "results": [{"score": 0.82, "uplift": 0.1}],
    }

    def fake_pipeline(model: str):
        assert model == "sentiment-analysis"

        class Runner:
            def __call__(self, texts):  # noqa: D401
                return [{"label": "POSITIVE", "score": 0.55} for _ in texts]

        return Runner()

    monkeypatch.setattr("services.share_viz_endpoint.pipeline", fake_pipeline)
    monkeypatch.setattr("services.share_viz_endpoint.HAS_TRANSFORMERS", True)

    dispatched: dict[str, Any] = {}

    def record_dispatch(cid: str, zk_hash: str) -> None:
        dispatched["cid"] = cid
        dispatched["hash"] = zk_hash

    monkeypatch.setattr("services.share_viz_endpoint.dispatch_to_base_oracle", record_dispatch)

    test_client = app.test_client()
    response = test_client.get(
        f"/narrative_neutrality_audit/{viz_cid}",
        headers={"Authorization": "Bearer guardian_token"},
    )

    assert response.status_code == 200
    body = response.get_json()
    assert dispatched["cid"] == viz_cid
    assert body["bias_alert"] is False
    assert body["balanced_recommendation"] == "neutral"
    assert body["neutrality_score"] == pytest.approx(0.1, abs=1e-6)
    assert body["text_aggregate_hash"] == dispatched["hash"]
    assert body["mission_statement"] == MISSION_STATEMENT
    detail = body["recommendation_detail"].lower()
    assert any(keyword in detail for keyword in {"protect", "safeguard"})
    assert not STREAM_EMIT_QUEUE
    assert PINNED_VIZ[viz_cid]["narrative_audits"]


def test_bias_alert_high(monkeypatch: pytest.MonkeyPatch) -> None:
    """Narrative audit triggers alert and stream emission for biased text."""

    viz_cid = "narrative-bias"
    PINNED_VIZ[viz_cid] = {
        "wallet": "0xBBB",
        "mission_anchor": MISSION_STATEMENT,
        "results": [{"score": 0.9, "uplift": 0.2}],
    }

    def bias_pipeline(model: str):
        assert model == "sentiment-analysis"

        class Runner:
            def __call__(self, texts):  # noqa: D401
                return [{"label": "POSITIVE", "score": 0.99} for _ in texts]

        return Runner()

    monkeypatch.setattr("services.share_viz_endpoint.pipeline", bias_pipeline)
    monkeypatch.setattr("services.share_viz_endpoint.HAS_TRANSFORMERS", True)

    emissions: list[dict[str, Any]] = []

    def capture_dispatch(cid: str, zk_hash: str) -> None:
        emissions.append({"cid": cid, "hash": zk_hash})

    monkeypatch.setattr("services.share_viz_endpoint.dispatch_to_base_oracle", capture_dispatch)

    test_client = app.test_client()
    response = test_client.get(
        f"/narrative_neutrality_audit/{viz_cid}",
        headers={"Authorization": "Bearer guardian_token"},
    )

    assert response.status_code == 200
    body = response.get_json()
    assert emissions and emissions[0]["cid"] == viz_cid
    assert body["bias_alert"] is True
    assert body["balanced_recommendation"] == "rebalance"
    assert body["resonance_adjusted"] == pytest.approx(0.71, abs=1e-6)
    assert STREAM_EMIT_QUEUE
    alert = STREAM_EMIT_QUEUE.popleft()
    assert alert["narrative_alert"] is True
    assert alert["viz_cid"] == viz_cid
    assert "mission_statement" in alert


def test_paradox_resolver_unsat_paradox(monkeypatch: pytest.MonkeyPatch) -> None:
    """Paradox resolver detects unsatisfiable clauses and emits alerts."""

    viz_cid = "paradox-unsat"
    STREAM_EMIT_QUEUE.clear()
    PINNED_VIZ[viz_cid] = {
        "wallet": "0xPARA",
        "mission_anchor": MISSION_STATEMENT,
        "results": [{"score": 0.82, "uplift": 0.2}],
        "mission_clauses": [["empathy"], ["~empathy"]],
    }

    monkeypatch.setattr("services.share_viz_endpoint.TelemetryClass", DummyTelemetry)

    test_client = app.test_client()
    response = test_client.get(
        f"/paradox_resolver_engine/{viz_cid}",
        headers={"Authorization": "Bearer guardian_token"},
    )

    assert response.status_code == 200
    body = response.get_json()
    assert body["satisfiability"] is False
    assert body["paradox_alert"] is True
    assert body["min_flips"] == 1
    assert body["resolution"] == "flipped_empathy"
    assert body["erv_resonance"] == pytest.approx(0.77, abs=1e-6)
    assert len(body["clause_commitment"]) == 64
    assert STREAM_EMIT_QUEUE
    emission = STREAM_EMIT_QUEUE[-1]
    assert emission["paradox_alert"] is True
    assert emission["flips"] == 1
    assert emission["viz_cid"] == viz_cid


def test_paradox_resolver_sat_consistent(monkeypatch: pytest.MonkeyPatch) -> None:
    """Paradox resolver reports satisfiable clauses without emissions."""

    viz_cid = "paradox-sat"
    STREAM_EMIT_QUEUE.clear()
    PINNED_VIZ[viz_cid] = {
        "wallet": "0xSAFE",
        "mission_anchor": MISSION_STATEMENT,
        "results": [{"score": 0.74, "uplift": 0.1}],
        "mission_clauses": [["protect"], ["empathy", "protect"]],
    }

    monkeypatch.setattr("services.share_viz_endpoint.TelemetryClass", DummyTelemetry)

    test_client = app.test_client()
    response = test_client.get(
        f"/paradox_resolver_engine/{viz_cid}",
        headers={"Authorization": "Bearer guardian_token"},
    )

    assert response.status_code == 200
    body = response.get_json()
    assert body["satisfiability"] is True
    assert body["paradox_alert"] is False
    assert body["min_flips"] == 0
    assert body["resolution"] == "consistent"
    assert body["erv_resonance"] == pytest.approx(0.74, abs=1e-6)
    assert len(body["clause_commitment"]) == 64
    assert not STREAM_EMIT_QUEUE
