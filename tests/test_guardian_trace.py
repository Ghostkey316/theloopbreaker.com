from __future__ import annotations

import json

from vaultfire.security.guardian_trace import (
    alert_identity_anomalies,
    auto_lock_unique_signal_origin,
    log_clone_attempts,
    track_fingerprint_activity,
    validate_behavior_signature,
)


def _write_jsonl(path, entries):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for entry in entries:
            handle.write(json.dumps(entry) + "\n")


def test_guardian_trace_detects_wallet_and_fingerprint_conflicts(tmp_path):
    activity_path = tmp_path / "guardian_trace_activity.jsonl"
    entries = [
        {
            "agent_id": "Ghostkey316",
            "wallet": "bpow20.cb.id",
            "fingerprint_hash": "primary",
            "signature_hash": "ghostkey-316",
            "timestamp": "2024-01-01T00:00:00Z",
        },
        {
            "agent_id": "MirrorGhost",
            "wallet": "bpow20.cb.id",
            "fingerprint_hash": "primary",
            "signature_hash": "mirror-ghost",
            "timestamp": "2024-01-01T00:00:10Z",
        },
    ]
    _write_jsonl(activity_path, entries)

    activity_log = track_fingerprint_activity(activity_path)
    anomalies = alert_identity_anomalies(activity_log, "Ghostkey316")

    assert anomalies
    assert not validate_behavior_signature("Ghostkey316", "bpow20.cb.id", activity_log)

    clone_log = tmp_path / "clone_attempts.jsonl"
    log_clone_attempts(
        "Ghostkey316",
        activity_log,
        anomalies=anomalies,
        destination=clone_log,
    )
    clone_log_contents = clone_log.read_text(encoding="utf-8")
    assert "Ghostkey316" in clone_log_contents
    assert "Wallet bpow20.cb.id is also used" in clone_log_contents

    lock_path = tmp_path / "lock_state.json"
    lock_state = auto_lock_unique_signal_origin("Ghostkey316", destination=lock_path)
    assert lock_state["locked"] is True
    assert lock_state["agent_id"] == "Ghostkey316"
    assert lock_path.exists()

