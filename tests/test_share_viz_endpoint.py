"""Tests for the share_viz Flask endpoints."""

from __future__ import annotations

import json
from typing import Any

import pytest

from services.share_viz_endpoint import MISSION_STATEMENT, PINNED_VIZ, _compute_zk_hash, app


class DummyTelemetry:
    """Telemetry stub that records interactions for assertions."""

    def __init__(self, mission_anchor: str, *, consent: bool = True) -> None:  # noqa: D401
        self.mission_anchor = mission_anchor
        self.consent = consent
        self.results = None

    def end_to_end_test(self, num_iters: int = 6) -> list[dict[str, Any]]:
        return [
            {"wallet": f"0x{i}", "score": 0.5 + i * 0.1, "uplift": i * 0.01, "status": "attested"}
            for i in range(num_iters)
        ]

    def interactive_viz(self, results: list[dict[str, Any]]) -> None:
        self.results = results


@pytest.fixture(autouse=True)
def clear_state(monkeypatch: pytest.MonkeyPatch) -> None:
    """Reset in-memory state and patch telemetry for each test."""

    PINNED_VIZ.clear()
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
