import json
from datetime import datetime, timedelta, timezone

import pytest

from tools.scale_readiness_report import compile_scale_snapshot


@pytest.fixture()
def scale_paths(tmp_path, monkeypatch):
    from tools import scale_readiness_report as report_module
    from types import SimpleNamespace

    log_path = tmp_path / "scale_log.json"
    index_path = tmp_path / "scale_index.json"
    profiles_path = tmp_path / "profiles.json"
    attest_dir = tmp_path / "attestations"
    attest_dir.mkdir()

    stub = SimpleNamespace(
        SCALE_LOG_PATH=log_path,
        PURPOSE_INDEX_PATH=index_path,
        PURPOSE_PROFILES_PATH=profiles_path,
        BASE_DIR=tmp_path,
        RECOGNIZED_MISSION_THREADS={"vaultfire", "ghostkey-316", "ns3"},
    )
    monkeypatch.setattr(report_module, "_purposeful_scale", lambda: stub)

    profiles_path.write_text(json.dumps({"guardian.eth": {"mission": "Safeguard"}}, indent=2))

    return log_path, index_path, profiles_path, attest_dir


def test_compile_scale_snapshot_identifies_readiness(scale_paths, monkeypatch):
    log_path, index_path, profiles_path, attest_dir = scale_paths

    now = datetime.now(timezone.utc)
    recent = now.isoformat().replace("+00:00", "Z")

    log_entries = [
        {
            "timestamp": recent,
            "user_id": "guardian.eth",
            "operation": "scale.ok",
            "mission_tags": ["Vaultfire", "NS3", "Ghostkey-316"],
            "approved": True,
            "belief_density": 0.82,
            "alignment": 0.91,
            "reason": "approved",
        }
    ]
    log_path.write_text(json.dumps(log_entries, indent=2))

    attestation_path = attest_dir / "guardian_attestation.json"
    attestation_payload = {
        "user_id": "guardian.eth",
        "generated_at": recent,
        "attestation_hash": "abc123",
    }
    attestation_path.write_text(json.dumps(attestation_payload, indent=2))

    report = compile_scale_snapshot(history_limit=10)

    assert report["entries"] == 1
    assert report["scale_ready"] is True
    assert report["approval_rate"] == 1.0
    assert report["profile_count"] == 1
    assert report["attestations"]["count"] == 1
    assert report["attestations"]["latest_attestation_hash"] == "abc123"


def test_compile_scale_snapshot_flags_stale(scale_paths, monkeypatch):
    log_path, index_path, profiles_path, attest_dir = scale_paths

    stale_time = datetime.now(timezone.utc) - timedelta(hours=12)
    timestamp = stale_time.isoformat().replace("+00:00", "Z")

    log_entries = [
        {
            "timestamp": timestamp,
            "user_id": "guardian.eth",
            "operation": "scale.ok",
            "mission_tags": ["Vaultfire", "Ghostkey-316"],
            "approved": True,
            "belief_density": 0.7,
            "alignment": 0.9,
            "reason": "approved",
        }
    ]
    log_path.write_text(json.dumps(log_entries, indent=2))

    report = compile_scale_snapshot(history_limit=5)

    assert report["scale_ready"] is False
    assert any("stale" in note for note in report["readiness_notes"])
