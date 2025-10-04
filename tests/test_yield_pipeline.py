from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient

from yield_pipeline import convert_pilot_logs, create_app, settings
from yield_pipeline.engine import simulate_activation_to_yield


def _write_pilot_log(path: Path, mission_id: str, belief_id: str, ghostscore: float) -> None:
    payload = {
        "mission_id": mission_id,
        "pilot_id": "pilot-test",
        "belief_id": belief_id,
        "timestamp": "2024-01-01T00:00:00Z",
        "trigger_event": "Test event",
        "ghostscore_delta": ghostscore,
        "activation_signals": [{"signal": "alpha", "weight": 0.5}],
    }
    path.write_text(json.dumps(payload), encoding="utf-8")


def test_convert_pilot_logs(tmp_path, monkeypatch):
    source = tmp_path / "missions"
    dest = tmp_path / "cases"
    source.mkdir()
    _write_pilot_log(source / "mission_one.json", "mission-one", "belief-engage-01", 10.0)
    _write_pilot_log(source / "mission_two.json", "mission-two", "belief-retain-04", 15.0)

    monkeypatch.setattr(settings, "mission_logs_dir", source)
    monkeypatch.setattr(settings, "case_study_dir", dest)

    studies = convert_pilot_logs()
    assert len(studies) == 2
    for study in studies:
        assert study.mission_hash
        assert study.belief_segment.startswith("belief-")
        assert study.trigger_summary == "Test event"


def test_api_endpoint_filters(tmp_path, monkeypatch):
    source = tmp_path / "missions"
    dest = tmp_path / "cases"
    attestations = tmp_path / "attestations.json"
    source.mkdir()
    _write_pilot_log(source / "mission_one.json", "mission-one", "belief-engage-01", 10.0)
    _write_pilot_log(source / "mission_two.json", "mission-two", "belief-retain-04", 15.0)

    monkeypatch.setattr(settings, "mission_logs_dir", source)
    monkeypatch.setattr(settings, "case_study_dir", dest)
    monkeypatch.setattr(settings, "attestations_path", attestations)
    monkeypatch.setattr(settings, "api_key", None)

    app = create_app()
    client = TestClient(app)
    response = client.get(
        "/api/yield-insights",
        params={"segment_id": "belief-04", "date_range": "2023-12-31T00:00:00,2024-12-31T23:59:59"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["belief_segment"] == "belief-04"

    audit = json.loads(attestations.read_text(encoding="utf-8"))
    assert audit[0]["results"] == 1


def test_simulate_activation_to_yield(tmp_path, monkeypatch):
    source = tmp_path / "missions"
    source.mkdir()
    _write_pilot_log(source / "mission_one.json", "mission-one", "belief-convert-01", 25.0)

    monkeypatch.setattr(settings, "mission_logs_dir", source)
    monkeypatch.setattr(settings, "yield_reports_dir", tmp_path / "reports")

    result = simulate_activation_to_yield("pilot-test")
    assert "user_hash" in result
    assert result["mission_hashes"]
    report_files = list((tmp_path / "reports").glob("*.json"))
    assert report_files


def test_proof_route_exposes_readiness(tmp_path, monkeypatch):
    source = tmp_path / "missions"
    dest = tmp_path / "cases"
    attestations = tmp_path / "attestations.json"
    source.mkdir()
    _write_pilot_log(source / "mission_one.json", "mission-one", "belief-convert-01", 12.0)

    monkeypatch.setattr(settings, "mission_logs_dir", source)
    monkeypatch.setattr(settings, "case_study_dir", dest)
    monkeypatch.setattr(settings, "attestations_path", attestations)
    monkeypatch.setattr(settings, "api_key", None)

    app = create_app()
    client = TestClient(app)
    response = client.get("/api/proof/v1/ghostkey-316")
    assert response.status_code == 200
    payload = response.json()
    assert payload["partner_ready"] is True
    assert payload["ghostkey_case"] == "first externally-visible proof point"
    assert payload["reward_interface"]["stream_ready"] is True
    assert payload["reward_interface"]["on_chain_ready"] is False
    assert payload["audit_storage"]["beta_compatible"] is True
    environments = payload["audit_storage"].get("environments", [])
    tags = {entry["vaultfire_env"] for entry in environments}
    assert {"ghostkey_testbed", "prod_ready"}.issubset(tags)
