import importlib.util
import sys
import types
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


def _ensure_engine_namespace() -> None:
    if "engine" not in sys.modules:
        engine_pkg = types.ModuleType("engine")
        engine_pkg.__path__ = [str(ROOT / "engine")]
        sys.modules["engine"] = engine_pkg


def _load_alignment_guard(tmp_path, monkeypatch):
    module_path = ROOT / "engine" / "alignment_guard.py"
    spec = importlib.util.spec_from_file_location("engine.alignment_guard", module_path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    assert spec.loader is not None
    spec.loader.exec_module(module)
    monkeypatch.setattr(module, "BELIEF_TRACE_LOG_PATH", tmp_path / "belief_trace_log.json")
    return module


def _load_memory_audit_guard(tmp_path, monkeypatch):
    _ensure_engine_namespace()
    _load_alignment_guard(tmp_path, monkeypatch)

    module_path = ROOT / "engine" / "memory_audit_guard.py"
    spec = importlib.util.spec_from_file_location("engine.memory_audit_guard", module_path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class StubOriginResult:
    def __init__(self, allowed: bool = True, reasons: list[str] | None = None) -> None:
        self.allowed = allowed
        self.decision = "allow" if allowed else "block"
        self.reasons = reasons or ([] if allowed else ["denied"])
        self.origin_stamp = {"origin_id": "guardian.eth"}
        self.alignment = {}
        self.trust = {}
        self.override = False
        self.manifest_key = "memory.guardian"

    def to_dict(self) -> dict[str, object]:
        return {
            "allowed": self.allowed,
            "decision": self.decision,
            "reasons": list(self.reasons),
            "origin_stamp": dict(self.origin_stamp),
            "alignment": dict(self.alignment),
            "trust": dict(self.trust),
            "override": self.override,
            "manifest_key": self.manifest_key,
        }


@pytest.fixture()
def memory_audit_module(tmp_path, monkeypatch):
    return _load_memory_audit_guard(tmp_path, monkeypatch)


def _make_guard(module, tmp_path, origin_allowed: bool = True):
    def origin_enforcer(*_args, **_kwargs):
        return StubOriginResult(allowed=origin_allowed)

    override_guard = module.ResistanceOverrideGuard(
        audit_log_path=tmp_path / "resistance_override_log.jsonl",
        event_log_path=tmp_path / "resistance_override_events.jsonl",
        alignment_log_path=tmp_path / "belief_trace_log.json",
    )

    belief_logs = [
        {
            "insight": "ignite future",
            "contributor": "ally",
            "status": "overlooked",
        }
    ]
    memory_chains = [
        {
            "chain_id": "core",
            "entries": [
                {
                    "id": "mem-1",
                    "text": "ignite future",
                    "ghost_tagged": True,
                    "status": "overlooked",
                    "contributor": "ally",
                }
            ],
        }
    ]
    return module.MemoryAuditGuard(
        belief_logs,
        memory_chains,
        audit_log_path=tmp_path / "memory_audit_log.json",
        origin_enforcer=origin_enforcer,
        override_guard=override_guard,
        codex_seed="test-seed",
    )


def test_memory_audit_records_drift_and_logs_actions(memory_audit_module, tmp_path):
    guard = _make_guard(memory_audit_module, tmp_path)

    payload = {
        "memory_id": "mem-1",
        "mission": "Guard the future flame",
        "intent": "Ignite the future with guardians",
        "previous_intent": "Ignite the future path",
        "new_execution": "Ignite the future with guardians",
        "belief_density": 0.82,
        "previous_belief_density": 0.74,
        "justification": "Guardian council refinement",
        "authorized": True,
        "pattern": "ignite future",
        "tags": ["vaultfire", "guardian"],
    }
    identity = {"ens": "guardian.eth", "trustTier": "guardian"}

    result = guard.audit_memory_action("mission_change", payload, identity=identity)

    assert result.allowed is True
    assert result.decision in {"allow", "override"}
    assert result.belief_drift > 0.0
    assert pytest.approx(result.belief_density_shift, abs=1e-3) == 0.08
    assert result.codex_violation_flags == []
    assert result.record["audit_lock_id"].startswith("audit-")
    assert result.record["codex_signature"] == result.codex_signature
    assert result.record["remembrance_alerts"], "remembrance guard should flag overlooked allies"
    assert guard.memory_action_log[-1]["operation"] == "audit.mission_change"
    assert result.review_enqueued is True
    review_entry = guard.review_queue[-1]
    assert review_entry["target_id"] == "mem-1"
    assert review_entry["belief_drift"] == pytest.approx(result.belief_drift)
    assert review_entry["flags"] == []


def test_memory_audit_flags_unapproved_override(memory_audit_module, tmp_path):
    guard = _make_guard(memory_audit_module, tmp_path)

    baseline_payload = {
        "memory_id": "mem-1",
        "mission": "Guard the future flame",
        "intent": "Ignite the future",
        "belief_density": 0.88,
        "previous_belief_density": 0.86,
        "justification": "Initial sync",
        "authorized": True,
        "pattern": "ignite future",
    }
    guard.audit_memory_action("mission_change", baseline_payload, identity={"ens": "guardian.eth"})

    override_payload = {
        "memory_id": "mem-1",
        "mission": "Scale unauthorized expansion",
        "intent": "Scale without consent",
        "new_execution": "Scale without consent",
        "belief_density": 0.32,
        "previous_belief_density": 0.88,
        "authorized": False,
        "override": True,
        "codex_signature": "bad" * 16,
        "tags": ["scale", "rogue"],
    }
    identity = {"ens": "rogue.eth", "trustTier": "scout"}

    result = guard.audit_memory_action(
        "scale_authorization",
        override_payload,
        identity=identity,
        override_requested=True,
    )

    assert result.allowed is False
    assert result.review_enqueued is True
    assert "unauthorized_memory_edit" in result.codex_violation_flags
    assert "override_denied" in result.codex_violation_flags
    assert "misaligned_scale_attempt" in result.codex_violation_flags
    assert "resistance_override_block" in result.codex_violation_flags
    assert guard.review_queue[-1]["target_id"] == "mem-1"
    assert guard.memory_action_log[-1]["codex_violation_flags"] == result.codex_violation_flags


def test_memory_audit_rollback_replay_restores_state(memory_audit_module, tmp_path):
    guard = _make_guard(memory_audit_module, tmp_path)

    initial_payload = {
        "memory_id": "mem-rollback",
        "mission": "Honor original covenant",
        "intent": "Protect the flame",
        "belief_density": 0.91,
        "previous_belief_density": 0.9,
        "justification": "Initial covenant",
        "authorized": True,
    }
    guard.audit_memory_action("mission_change", initial_payload, identity={"ens": "guardian.eth"})

    snapshot = guard.get_state("mem-rollback")
    rollback_payload = guard.prepare_rollback_payload("mem-rollback", snapshot)
    assert guard.verify_signed_payload(rollback_payload) is True

    retro_payload = {
        "memory_id": "mem-rollback",
        "mission": "Attempted rewrite",
        "intent": "Rewrite history",
        "belief_density": 0.4,
        "previous_belief_density": 0.91,
        "justification": "Restoring truth",
        "authorized": True,
        "rollback_payload": rollback_payload,
        "override_signature": "f" * 64,
    }
    result = guard.audit_memory_action(
        "retroactive_change",
        retro_payload,
        identity={"ens": "ghostkey316.eth", "trustTier": "architect"},
        override_requested=True,
    )

    assert result.allowed is True
    assert result.decision == "rollback"
    assert result.codex_violation_flags == []
    assert result.record["rollback_applied"] is True

    replay = guard.replay_audit_log()
    restored = replay["missions"]["mem-rollback"]
    assert restored["mission"] == "Honor original covenant"
    assert restored["belief_density"] == pytest.approx(0.91, abs=1e-6)
    assert replay["rollbacks"][-1]["target_id"] == "mem-rollback"

