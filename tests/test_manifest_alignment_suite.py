from __future__ import annotations

import pytest

from vaultfire.consciousness import PulsewatchSyncStatus
from vaultfire.ethics import EthicsAutoCorrectSuite
from vaultfire.manifest import CodexConfirmationSeal


@pytest.fixture(autouse=True)
def reset_state(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(CodexConfirmationSeal, "_records", [], raising=False)
    monkeypatch.setattr(CodexConfirmationSeal, "_logs", [], raising=False)
    monkeypatch.setattr(PulsewatchSyncStatus, "_history", [], raising=False)
    monkeypatch.setattr(EthicsAutoCorrectSuite, "_runs", [], raising=False)


def test_codex_confirmation_seal_records_metadata() -> None:
    payload = {
        "version": "v6.1",
        "modules": ["vaultfire.consciousness", "CognitiveEquilibriumEngine"],
        "features": ("loop", "telemetry"),
        "verified_by": "pytest run",
        "lead": "Ghostkey-316",
    }

    result = CodexConfirmationSeal.record(payload)

    assert result["version"] == "v6.1"
    assert result["modules"] == ["vaultfire.consciousness", "CognitiveEquilibriumEngine"]
    assert result["features"] == ["loop", "telemetry"]
    # Ensure the original payload is not mutated
    assert payload["features"] == ("loop", "telemetry")

    log = CodexConfirmationSeal.commit_log("Vaultfire v6.1 complete")

    assert "timestamp" in result and "timestamp" in log
    assert log["message"] == "Vaultfire v6.1 complete"
    history = CodexConfirmationSeal.history()
    assert history["records"][-1] == result
    assert history["logs"][-1] == log
    assert CodexConfirmationSeal.last_record() == result
    assert CodexConfirmationSeal.last_log() == log


def test_pulsewatch_sync_status_confirms_axes() -> None:
    event = PulsewatchSyncStatus.confirm_alignment(
        "Ethics",
        "Emotion",
        "Logic",
        telemetry={"source": "unit-test"},
    )

    assert event["axes"] == ["ethics", "emotion", "logic"]
    assert event["status"] == "aligned"
    assert event["telemetry"] == {"source": "unit-test"}
    assert PulsewatchSyncStatus.last_alignment() == event
    assert PulsewatchSyncStatus.history()[-1] == event

    with pytest.raises(ValueError):
        PulsewatchSyncStatus.confirm_alignment("   ")


def test_ethics_auto_correct_suite_runs_all_checks() -> None:
    result = EthicsAutoCorrectSuite.full_validation()

    assert result["verified"] is True
    assert len(result["checks"]) == result["summary"]["total_checks"]
    assert result["summary"]["passed"] == result["summary"]["total_checks"]
    assert EthicsAutoCorrectSuite.last_run() == result
    assert EthicsAutoCorrectSuite.history()[-1] == result
