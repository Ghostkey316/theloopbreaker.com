import json
from pathlib import Path

import pytest

from engine.resistance_override_guard import ResistanceOverrideGuard


def _write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2))


def _seed_environment(tmp_path: Path) -> None:
    logs_dir = tmp_path / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    registry = {
        "bpow20.cb.id": {
            "identity": "Ghostkey-316",
            "ens": "ghostkey316.eth",
            "role": "Architect",
            "tags": ["vaultfire", "architect"],
        },
        "ally.id": {
            "identity": "Ally",
            "ens": "ally.eth",
            "role": "guardian",
        },
    }
    _write_json(tmp_path / "contributor_registry.json", registry)
    partners = [
        {
            "partner_id": "ghostkey316.eth",
            "wallet": "bpow20.cb.id",
            "role": "Architect",
        }
    ]
    _write_json(tmp_path / "partners.json", partners)
    scorecard = {
        "ghostkey316.eth": {"contributor_tag": "Architect"},
        "ally.eth": {"contributor_tag": "Guardian"},
    }
    _write_json(tmp_path / "user_scorecard.json", scorecard)
    alignment_log = [
        {"identity": "ghostkey316.eth", "decision": "allow", "allowed": True},
        {"identity": "ally.eth", "decision": "allow", "allowed": True},
    ]
    _write_json(logs_dir / "belief_trace_log.json", alignment_log)


def _make_guard(tmp_path: Path) -> ResistanceOverrideGuard:
    logs_dir = tmp_path / "logs"
    return ResistanceOverrideGuard(
        base_dir=tmp_path,
        audit_log_path=logs_dir / "resistance_override_log.jsonl",
        event_log_path=logs_dir / "resistance_override_events.jsonl",
        contributor_registry_path=tmp_path / "contributor_registry.json",
        partners_path=tmp_path / "partners.json",
        scorecard_path=tmp_path / "user_scorecard.json",
        alignment_log_path=logs_dir / "belief_trace_log.json",
    )


def test_resistance_guard_rejects_non_architect_override(tmp_path: Path) -> None:
    _seed_environment(tmp_path)
    guard = _make_guard(tmp_path)

    payload = {
        "override": True,
        "mission_type": "growth",
        "mission_policy": "architect-only",
        "codex_signature": "abcd" * 16,
    }
    decision = guard.validate(
        "mission.record",
        "ally.eth",
        override_payload=payload,
        context={"pathway": "growth"},
    )

    assert decision.allowed is False
    assert "insufficient_clearance" in decision.reasons
    event_log = guard.load_event_log()
    assert event_log[-1]["event"] == "override_rejection_event"


def test_resistance_guard_allows_architect_signature(tmp_path: Path) -> None:
    _seed_environment(tmp_path)
    guard = _make_guard(tmp_path)

    payload = {
        "override": True,
        "mission_type": "rollback",
        "mission_policy": "lawful-rollback",
        "codex_signature": "f" * 64,
    }
    decision = guard.validate(
        "memory.rollback",
        "ghostkey316.eth",
        override_payload=payload,
        context={"pathway": "rollback"},
    )

    assert decision.allowed is True
    assert decision.audit_entry is not None
    audit_log = guard.load_audit_log()
    assert audit_log[-1]["status"] == "allowed"


def test_resistance_guard_detects_protected_memory_override(tmp_path: Path) -> None:
    _seed_environment(tmp_path)
    guard = _make_guard(tmp_path)

    payload = {
        "override": True,
        "mission_type": "memory",
        "codex_signature": "f" * 64,
    }
    decision = guard.validate(
        "memory.rewrite",
        "ghostkey316.eth",
        override_payload=payload,
        context={"pathway": "memory"},
    )

    assert decision.allowed is False
    assert "protected_pathway" in decision.reasons


def test_resistance_guard_logs_all_attempts(tmp_path: Path) -> None:
    _seed_environment(tmp_path)
    guard = _make_guard(tmp_path)

    fail_payload = {
        "override": True,
        "mission_type": "growth",
        "mission_policy": "architect-only",
        "codex_signature": "beef" * 16,
    }
    guard.validate(
        "mission.record",
        "ally.eth",
        override_payload=fail_payload,
        context={"pathway": "growth"},
    )

    success_payload = {
        "override": True,
        "mission_type": "rollback",
        "mission_policy": "lawful-rollback",
        "codex_signature": "c" * 64,
    }
    guard.validate(
        "memory.rollback",
        "ghostkey316.eth",
        override_payload=success_payload,
        context={"pathway": "rollback"},
    )

    audit_log = guard.load_audit_log()
    statuses = {entry.get("status") for entry in audit_log}
    assert statuses == {"allowed", "rejected"}
    assert len(audit_log) == 2
    event_log = guard.load_event_log()
    assert len(event_log) == 1
