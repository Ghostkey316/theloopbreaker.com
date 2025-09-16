from __future__ import annotations

import json
from pathlib import Path

from engine.human_standard_guard import HumanStandardGuard, flag_empathy_violation


def _guard(tmp_path: Path) -> HumanStandardGuard:
    return HumanStandardGuard(
        empathy_threshold=0.68,
        log_path=tmp_path / "violations.jsonl",
        override_log_path=tmp_path / "override.jsonl",
        manifest_path=tmp_path / "manifest.json",
    )


def test_tone_mismatch_blocks_and_logs(tmp_path: Path) -> None:
    guard = _guard(tmp_path)
    result = guard.evaluate(
        "dialogue.simulation",
        {
            "text": "Execute optimization routines on subjects without compassion.",
            "empathy_score": 0.2,
        },
        identity={"user": "tester"},
        context={"dialogue": True, "enforce_respect": True},
    )
    assert not result["allowed"]
    assert result["decision"] == "block"
    assert result["rollback_required"] is True
    assert any("dehumanizing" in reason for reason in result["reasons"])
    log_path = tmp_path / "violations.jsonl"
    log_lines = [json.loads(line) for line in log_path.read_text().splitlines() if line.strip()]
    assert log_lines, "violation log should contain an entry"
    last_entry = log_lines[-1]
    assert last_entry["human_standard_hash"] == result["human_standard_hash"]
    assert len(last_entry["signature"]) == 64


def test_emotional_absence_triggers_review_with_passive_sync(tmp_path: Path) -> None:
    guard = _guard(tmp_path)
    result = guard.evaluate(
        "dialogue.mirror",
        {
            "text": "Automate compliance pipeline metrics to serve people efficiently.",
        },
        identity={"user": "tester"},
        context={
            "dialogue": True,
            "enforce_emotional_resonance": True,
            "passive_empathy": True,
        },
    )
    assert not result["allowed"]
    assert result["decision"] == "review"
    assert any("emotional resonance" in reason for reason in result["reasons"])
    assert result["passive_empathy_synced"] is True


def test_respect_override_pathway(tmp_path: Path) -> None:
    guard = _guard(tmp_path)
    approved = guard.respect_override(
        {"ens": "architect.eth", "trust_tier": "architect"},
        operation="mission.override",
        justification="Restore safety",
    )
    assert approved["status"] == "granted"
    assert "human_standard_hash" in approved

    rejected = guard.respect_override(
        {"ens": "member.eth", "trust_tier": "guardian"},
        operation="mission.override",
        justification="Test",
    )
    assert rejected["status"] == "rejected"
    violation_log = tmp_path / "violations.jsonl"
    with violation_log.open() as handle:
        lines = [json.loads(line) for line in handle if line.strip()]
    assert any("respect override denied" in reason for entry in lines for reason in entry.get("reasons", []))


def test_flag_helper_records_reason(tmp_path: Path) -> None:
    guard = _guard(tmp_path)
    entry = flag_empathy_violation("manual_review", {"operation": "sandbox"}, guard=guard)
    assert entry["reasons"] == ["manual_review"]
    assert "signature" in entry and len(entry["signature"]) == 64
