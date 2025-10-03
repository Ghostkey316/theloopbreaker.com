import json
import importlib
import sys
import types
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parent

engine_pkg = types.ModuleType("engine")
engine_pkg.__path__ = [str(ROOT / "engine")]
sys.modules["engine"] = engine_pkg


def _bootstrap_purpose_engine_stub() -> types.ModuleType:
    module = types.ModuleType("engine.purpose_engine")
    module.PURPOSE_PATH = ROOT / "logs" / "purpose_profiles.json"

    def _load() -> dict:
        if module.PURPOSE_PATH.exists():
            return json.loads(module.PURPOSE_PATH.read_text())
        return {}

    def _write(data: dict) -> None:
        module.PURPOSE_PATH.parent.mkdir(parents=True, exist_ok=True)
        module.PURPOSE_PATH.write_text(json.dumps(data, indent=2))

    def record_traits(user_id: str, traits):
        data = _load()
        entry = data.get(user_id, {})
        entry["traits"] = list(traits)
        data[user_id] = entry
        _write(data)
        return entry

    def discover_purpose(user_id: str, traits):
        mission = f"Use {(traits[0] if traits else 'integrity')} to uplift your community."
        data = _load()
        entry = data.get(user_id, {})
        entry["mission"] = mission
        data[user_id] = entry
        _write(data)
        return mission

    module.record_traits = record_traits
    module.discover_purpose = discover_purpose
    sys.modules["engine.purpose_engine"] = module
    return module


purpose_engine = _bootstrap_purpose_engine_stub()
purposeful_scale = importlib.import_module("engine.purposeful_scale")
from vaultfire import echo, growth


@pytest.fixture()
def scale_env(tmp_path, monkeypatch):
    profiles = tmp_path / "purpose_profiles.json"
    log_path = tmp_path / "scale_log.json"
    index_path = tmp_path / "scale_index.json"
    growth_log = tmp_path / "growth.log"
    monkeypatch.setattr(purposeful_scale, "PURPOSE_PROFILES_PATH", profiles)
    monkeypatch.setattr(purposeful_scale, "SCALE_LOG_PATH", log_path)
    monkeypatch.setattr(purposeful_scale, "PURPOSE_INDEX_PATH", index_path)
    monkeypatch.setattr(purpose_engine, "PURPOSE_PATH", profiles)
    monkeypatch.setattr(growth, "LOG_PATH", growth_log)
    return profiles, log_path, index_path, growth_log


@pytest.fixture()
def echo_env(scale_env, tmp_path, monkeypatch):
    status_path = tmp_path / "companion_status.json"
    log_path = tmp_path / "companion_log.json"
    monkeypatch.setattr(echo, "STATUS_PATH", status_path)
    monkeypatch.setattr(echo, "LOG_PATH", log_path)
    return status_path, log_path


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


def test_mission_bootstrap_records_profile_when_missing(scale_env):
    profiles, _, _, _ = scale_env
    identity = {
        "ens": "guardian.eth",
        "wallet": "guardian.wallet",
        "beliefDensity": purposeful_scale.DEFAULT_BELIEF_THRESHOLD + 0.2,
        "missionTags": ["Vaultfire", "NS3", "Ghostkey-316"],
        "declaredPurpose": "Safeguard Vaultfire threads with integrity",
    }

    entry = growth.prepare_v26(identity)
    assert entry["scale_authorized"] is True

    profile_data = json.loads(profiles.read_text())
    stored = profile_data["guardian.eth"]
    assert stored["mission"] == identity["declaredPurpose"]
    assert stored["mission_source"] == "declared-purpose"


def test_mission_bootstrap_generates_when_purpose_absent(scale_env):
    profiles, _, _, _ = scale_env
    identity = {
        "ens": "guardian.eth",
        "wallet": "guardian.wallet",
        "beliefDensity": purposeful_scale.DEFAULT_BELIEF_THRESHOLD + 0.2,
        "missionTags": ["Vaultfire", "NS3", "Ghostkey-316"],
    }

    entry = growth.prepare_v26(identity)
    assert entry["scale_authorized"] is True

    profile_data = json.loads(profiles.read_text())
    stored = profile_data["guardian.eth"]
    assert stored["mission"]
    assert stored["mission_source"] in {"generated-purpose", "bootstrap-default:identity"}


def test_echo_deploy_respects_purposeful_scale(scale_env, echo_env):
    profiles, _, _, _ = scale_env
    status_path, log_path = echo_env
    mission = "Advance Vaultfire purpose with NS3 guardians"
    _write_profiles(profiles, "guardian.eth", mission)

    identity = {
        "ens": "guardian.eth",
        "wallet": "guardian.wallet",
        "beliefDensity": purposeful_scale.DEFAULT_BELIEF_THRESHOLD + 0.2,
        "missionTags": ["Vaultfire", "NS3", "Ghostkey-316"],
    }

    approved = echo.deploy_companion(identity)
    assert approved["scale_authorized"] is True
    state = json.loads(status_path.read_text())
    assert len(state["deployments"]) == 1
    assert state["deployments"][0]["mission_reference"] == mission

    rogue_identity = {
        "ens": "guardian.eth",
        "wallet": "guardian.wallet",
        "beliefDensity": purposeful_scale.DEFAULT_BELIEF_THRESHOLD + 0.2,
        "missionTags": ["rogue"],
        "declaredPurpose": "Break the mission",
    }

    blocked = echo.deploy_companion(rogue_identity)
    assert blocked["scale_authorized"] is False
    assert "blocked_reason" in blocked
    state_after = json.loads(status_path.read_text())
    assert len(state_after["deployments"]) == 1
    log_entries = json.loads(log_path.read_text())
    assert len(log_entries) == 2
    assert any(entry["scale_authorized"] is False for entry in log_entries)


def test_attestation_pack_compiles_signed_history(scale_env):
    profiles, _, _, _ = scale_env
    mission = "Safeguard Vaultfire threads with integrity"
    _write_profiles(profiles, "guardian.eth", mission)

    denied = purposeful_scale.belief_trace(
        "guardian.eth",
        {
            "operation": "growth.prepare_v26",
            "mission_tags": ["Vaultfire", "NS3"],
            "declared_purpose": mission,
            "belief_density": purposeful_scale.DEFAULT_BELIEF_THRESHOLD - 0.2,
        },
    )
    assert denied["approved"] is False

    approved = purposeful_scale.belief_trace(
        "guardian.eth",
        {
            "operation": "growth.prepare_v26",
            "mission_tags": ["Vaultfire", "NS3", "Ghostkey-316"],
            "declared_purpose": mission,
            "belief_density": purposeful_scale.DEFAULT_BELIEF_THRESHOLD + 0.2,
        },
    )
    assert approved["approved"] is True

    pack = purposeful_scale.generate_attestation_pack("guardian.eth", history_limit=5)
    assert pack["user_id"] == "guardian.eth"
    assert pack["mission_profile"]["mission"] == mission
    assert pack["decision_stats"]["total"] == 2
    assert pack["decision_stats"]["approved"] == 1
    assert pack["decision_stats"]["denied"] == 1
    assert pack["decision_history"][0]["approved"] is False
    assert pack["decision_history"][1]["approved"] is True
    assert pack["mission_recall_snapshot"]
    assert isinstance(pack["attestation_hash"], str)
    assert len(pack["attestation_hash"]) == 64
