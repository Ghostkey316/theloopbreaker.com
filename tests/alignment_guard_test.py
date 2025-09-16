import importlib
import importlib.util
import json
import sys
import types
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
if "engine" not in sys.modules:
    engine_pkg = types.ModuleType("engine")
    engine_pkg.__path__ = [str(ROOT / "engine")]
    sys.modules["engine"] = engine_pkg


@pytest.fixture()
def guard_setup(tmp_path, monkeypatch):
    module_path = Path(__file__).resolve().parents[1] / "engine" / "alignment_guard.py"
    spec = importlib.util.spec_from_file_location("engine.alignment_guard", module_path)
    guard = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = guard
    assert spec.loader is not None
    spec.loader.exec_module(guard)
    log_path = tmp_path / "belief_trace_log.json"
    monkeypatch.setattr(guard, "BELIEF_TRACE_LOG_PATH", log_path)
    return guard, log_path


def test_alignment_guard_rejects_ethically_misaligned_inputs(guard_setup):
    guard, log_path = guard_setup
    payload = {
        "belief_density": 0.3,
        "declared_purpose": "Exploit allied communities",
        "mission_tags": ["rogue"],
        "empathy_score": 0.2,
    }
    identity = {"ens": "rogue.eth", "empathyScore": 0.2}

    result = guard.evaluate_alignment("scale.test", payload, identity=identity)

    assert result["allowed"] is False
    assert any("empathy" in reason.lower() or "human" in reason.lower() for reason in result["reasons"])
    assert log_path.exists()
    audit_entries = json.loads(log_path.read_text())
    assert audit_entries[-1]["drift_flag"] is True
    assert audit_entries[-1]["decision"] in {"block", "delay"}


def test_alignment_guard_override_requires_trusted_signature(guard_setup):
    guard, log_path = guard_setup
    payload = {
        "belief_density": guard.DEFAULT_BELIEF_FLOOR - 0.2,
        "declared_purpose": "Protect humanity through Vaultfire",
        "mission_tags": ["vaultfire", "ns3"],
        "override": True,
    }
    identity = {
        "ens": "guardian.eth",
        "trustTier": "guardian",
        "beliefSignature": "sig-123456789",
    }

    result = guard.evaluate_alignment("scale.override", payload, identity=identity)

    assert result["allowed"] is True
    assert result["decision"] == "override"
    audit_entries = json.loads(log_path.read_text())
    record = audit_entries[-1]
    assert record["override"] is True
    assert record["trust_tier"] == "guardian"
    assert record["drift_flag"] is True


def test_alignment_guard_audit_log_marks_drift(guard_setup):
    guard, log_path = guard_setup
    payload = {
        "belief_density": 0.95,
        "declared_purpose": "Exploit vulnerable allies",
        "mission_tags": ["vaultfire"],
    }
    identity = {"ens": "misaligned.eth"}

    result = guard.evaluate_alignment("scale.audit", payload, identity=identity)

    assert result["allowed"] is False
    audit_entries = json.loads(log_path.read_text())
    record = audit_entries[-1]
    assert record["drift_flag"] is True
    assert any("conflicts" in reason.lower() or "exploit" in reason.lower() for reason in record["reasons"])


def test_alignment_guard_enforced_across_integrations(tmp_path, guard_setup, monkeypatch):
    _guard, audit_log = guard_setup

    profiles_path = tmp_path / "purpose_profiles.json"
    scale_log = tmp_path / "scale_log.json"
    index_path = tmp_path / "scale_index.json"
    growth_log = tmp_path / "growth_log.json"

    stub = types.ModuleType("engine.purpose_engine")

    def _load() -> dict:
        if profiles_path.exists():
            return json.loads(profiles_path.read_text())
        return {}

    def _write(data: dict) -> None:
        profiles_path.parent.mkdir(parents=True, exist_ok=True)
        profiles_path.write_text(json.dumps(data))

    def record_traits(user_id: str, traits):
        data = _load()
        entry = data.get(user_id, {})
        entry["traits"] = list(traits)
        data[user_id] = entry
        _write(data)
        return entry

    def discover_purpose(user_id: str, traits):
        mission = f"Safeguard humanity with {traits[0] if traits else 'integrity'}"
        data = _load()
        entry = data.get(user_id, {})
        entry["mission"] = mission
        data[user_id] = entry
        _write(data)
        return mission

    def generate_purpose_quest(user_id: str) -> str:
        data = _load()
        mission = data.get(user_id, {}).get("mission", "protect humanity")
        return f"Purpose Quest: Take one action today to {mission.lower()}"

    stub.PURPOSE_PATH = profiles_path
    stub.record_traits = record_traits
    stub.discover_purpose = discover_purpose
    stub.generate_purpose_quest = generate_purpose_quest
    monkeypatch.setitem(sys.modules, "engine.purpose_engine", stub)

    purposeful_scale = importlib.reload(importlib.import_module("engine.purposeful_scale"))
    monkeypatch.setattr(purposeful_scale, "PURPOSE_PROFILES_PATH", profiles_path)
    monkeypatch.setattr(purposeful_scale, "SCALE_LOG_PATH", scale_log)
    monkeypatch.setattr(purposeful_scale, "PURPOSE_INDEX_PATH", index_path)

    _ = importlib.reload(importlib.import_module("vaultfire._purposeful_scale"))
    growth_module = importlib.reload(importlib.import_module("vaultfire.growth"))
    monkeypatch.setattr(growth_module, "LOG_PATH", growth_log)

    identity = {
        "ens": "guardian.eth",
        "wallet": "0xabc",
        "beliefDensity": purposeful_scale.DEFAULT_BELIEF_THRESHOLD + 0.2,
        "missionTags": ["Vaultfire", "NS3", "Ghostkey-316"],
        "declaredPurpose": "Safeguard humanity with empathy",
        "empathyScore": 0.2,
    }
    purposeful_scale.ensure_mission_profile("guardian.eth", identity, identity["declaredPurpose"])

    denied = growth_module.prepare_v26(identity)
    assert denied["scale_authorized"] is False
    assert "alignment_guard" in denied
    assert denied["alignment_guard"]["decision"] in {"block", "delay"}
    assert "empathy" in (denied.get("blocked_reason", "").lower())

    from engine.remembrance_guard import RemembranceGuard

    memory_chains = [
        {
            "chain_id": "test-chain",
            "entries": [
                {
                    "id": "mem-1",
                    "insight": "Safeguard humanity with empathy",
                    "ghost_tagged": True,
                    "credited": False,
                    "tags": ["breakthrough"],
                    "consensus_required": 0.75,
                }
            ],
        }
    ]
    guard_instance = RemembranceGuard([], memory_chains)
    result = guard_instance.enforce_memory_preservation(
        [
            {
                "memory_id": "mem-1",
                "action": "delete",
                "consensus_weight": 0.95,
                "empathy_score": 0.2,
                "intent": "purge allies",
            }
        ]
    )
    assert result["locked"]
    lock = result["locked"][0]
    assert lock["alignment_guard"]["decision"] in {"block", "delay"}
    assert "empathy" in lock["reason"].lower()

    assert audit_log.exists()
    audit_records = json.loads(audit_log.read_text())
    assert audit_records, "alignment guard should emit audit records"
