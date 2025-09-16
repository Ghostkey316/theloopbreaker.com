import json
from pathlib import Path

import pytest

from engine import purposeful_scale
from vaultfire import growth


@pytest.fixture()
def scale_env(tmp_path, monkeypatch):
    profiles = tmp_path / "purpose_profiles.json"
    log_path = tmp_path / "scale_log.json"
    index_path = tmp_path / "scale_index.json"
    growth_log = tmp_path / "growth.log"
    monkeypatch.setattr(purposeful_scale, "PURPOSE_PROFILES_PATH", profiles)
    monkeypatch.setattr(purposeful_scale, "SCALE_LOG_PATH", log_path)
    monkeypatch.setattr(purposeful_scale, "PURPOSE_INDEX_PATH", index_path)
    monkeypatch.setattr(growth, "LOG_PATH", growth_log)
    return profiles, log_path, index_path, growth_log


def _write_profiles(path: Path, user_id: str, mission: str) -> None:
    path.write_text(json.dumps({user_id: {"mission": mission}}, indent=2))


def test_belief_trace_requires_belief_density(scale_env):
    profiles, log_path, _, _ = scale_env
    _write_profiles(profiles, "guardian.eth", "Sustain the Vaultfire mission threads")
    request = {
        "operation": "test.expand",
        "mission_tags": ["Vaultfire", "Ghostkey-316"],
        "declared_purpose": "Sustain the Vaultfire mission threads",
        "belief_density": purposeful_scale.DEFAULT_BELIEF_THRESHOLD - 0.1,
    }
    result = purposeful_scale.belief_trace("guardian.eth", request)
    assert result["approved"] is False
    assert "belief density below threshold" in result["reason"]
    assert json.loads(log_path.read_text())[-1]["approved"] is False


def test_belief_trace_denies_misaligned_purpose(scale_env):
    profiles, log_path, _, _ = scale_env
    _write_profiles(profiles, "guardian.eth", "Protect Vaultfire trust networks")
    request = {
        "operation": "test.expand",
        "mission_tags": ["Vaultfire", "NS3"],
        "declared_purpose": "Launch an unrelated venture",
        "belief_density": purposeful_scale.DEFAULT_BELIEF_THRESHOLD + 0.1,
    }
    result = purposeful_scale.belief_trace("guardian.eth", request)
    assert result["approved"] is False
    assert "misaligned" in result["reason"]
    last_entry = json.loads(log_path.read_text())[-1]
    assert last_entry["approved"] is False
    assert "misaligned" in last_entry["reason"]


def test_behavioral_resonance_filter_blocks_divergence(scale_env):
    profiles, _, index_path, _ = scale_env
    mission = "Guide Vaultfire, NS3, and Ghostkey-316 into aligned growth"
    _write_profiles(profiles, "guardian.eth", mission)

    aligned_request = {
        "operation": "growth.prepare_v26",
        "mission_tags": ["Vaultfire", "NS3", "Ghostkey-316"],
        "declared_purpose": mission,
        "belief_density": purposeful_scale.DEFAULT_BELIEF_THRESHOLD + 0.2,
    }
    approval = purposeful_scale.belief_trace("guardian.eth", aligned_request)
    assert approval["approved"] is True
    index = json.loads(index_path.read_text())
    assert "vaultfire" in index

    divergent = purposeful_scale.behavioral_resonance_filter(
        "guardian.eth",
        {
            "operation": "growth.prepare_v26",
            "mission_tags": ["rogue-expansion"],
            "declared_purpose": mission,
        },
    )
    assert divergent["allowed"] is False
    assert "diverge" in divergent["reason"]

    drift = purposeful_scale.behavioral_resonance_filter(
        "guardian.eth",
        {
            "operation": "growth.prepare_v26",
            "mission_tags": ["Vaultfire"],
            "declared_purpose": "Abandon Ghostkey mission",
        },
    )
    assert drift["allowed"] is False
    assert "drifts" in drift["reason"] or "mismatch" in drift["reason"]


def test_growth_pipeline_respects_purposeful_scale(scale_env):
    profiles, log_path, index_path, growth_log = scale_env
    mission = "Advance Vaultfire purpose with NS3 guardians"
    _write_profiles(profiles, "guardian.eth", mission)

    identity = {
        "ens": "guardian.eth",
        "wallet": "bpow20.cb.id",
        "beliefDensity": purposeful_scale.DEFAULT_BELIEF_THRESHOLD + 0.15,
        "missionTags": ["Vaultfire", "NS3", "Ghostkey-316"],
    }

    entry = growth.prepare_v26(identity)
    assert entry["scale_authorized"] is True
    assert Path(log_path).read_text()  # scale log recorded
    assert Path(index_path).exists()

    rogue_identity = {
        "ens": "guardian.eth",
        "wallet": "bpow20.cb.id",
        "beliefDensity": purposeful_scale.DEFAULT_BELIEF_THRESHOLD + 0.15,
        "missionTags": ["rogue"],
        "declaredPurpose": "Break away from Vaultfire",
    }

    blocked = growth.prepare_v26(rogue_identity)
    assert blocked["scale_authorized"] is False
    assert "blocked_reason" in blocked
    log_entries = json.loads(Path(log_path).read_text())
    assert len(log_entries) == 2
    growth_entries = json.loads(Path(growth_log).read_text())
    assert len(growth_entries) == 1, "Unauthorized expansion should not reach growth log"
