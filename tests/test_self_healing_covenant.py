"""Tests for the self-healing covenant repair endpoint."""

from __future__ import annotations

from typing import Iterator

import pytest

from services.share_viz_endpoint import (
    MISSION_STATEMENT,
    PINNED_VIZ,
    STREAM_EMIT_QUEUE,
    app,
)


@pytest.fixture(autouse=True)
def clear_state() -> Iterator[None]:
    """Ensure endpoint state is isolated between tests."""

    PINNED_VIZ.clear()
    STREAM_EMIT_QUEUE.clear()
    yield
    PINNED_VIZ.clear()
    STREAM_EMIT_QUEUE.clear()


def _register_stub_viz(viz_cid: str = "viz::stub") -> str:
    PINNED_VIZ[viz_cid] = {
        "wallet": "guardian::tester",
        "mission_anchor": MISSION_STATEMENT,
        "results": [],
        "auth_hash": "stub::hash",
    }
    return viz_cid


def test_heal_drift_alert() -> None:
    """ARIMA refits should heal drift and emit guardian updates."""

    viz_cid = _register_stub_viz()
    series = [0.51, 0.5, 0.48, 0.52, 0.47, 0.5, 0.49]
    with app.test_client() as client:
        response = client.post(
            f"/self_healing_covenant/{viz_cid}",
            json={"drift_alert": True, "historical_series": series},
            headers={"Authorization": "Bearer guardian_token"},
        )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["repair_status"] == "restored"
    assert payload["new_threshold"] <= 0.049 + 1e-6
    assert len(payload["healed_series"]) == 5
    assert payload["validation_rmse"] < 0.05
    assert "aggregate_hash" in payload

    record = PINNED_VIZ[viz_cid]
    assert len(record.get("belief_evolution", [])) >= 5

    assert STREAM_EMIT_QUEUE, "expected guardian notification emission"
    event = STREAM_EMIT_QUEUE.pop()
    assert event["self_heal"] is True
    assert event["repair_id"] == payload["repair_id"]
    assert event["uplift_restore"] >= 0.0


def test_no_alert_skip() -> None:
    """When no drift alert is raised the repair path should short-circuit."""

    viz_cid = _register_stub_viz("viz::noop")
    with app.test_client() as client:
        response = client.post(
            f"/self_healing_covenant/{viz_cid}",
            json={"drift_alert": False, "historical_series": [0.5] * 6},
            headers={"Authorization": "Bearer guardian_token"},
        )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["repair_status"] == "no_repair_needed"
    assert not STREAM_EMIT_QUEUE
