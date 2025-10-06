from __future__ import annotations

from datetime import datetime, timedelta, timezone

from vaultfire.privacy_integrity import PrivacyIntegrityShield, VaultTraceEraser


def test_trace_eraser_expires_records() -> None:
    eraser = VaultTraceEraser(expiration_seconds=1.0)
    past = datetime.now(timezone.utc) - timedelta(seconds=2)
    eraser.register({"user_hash": "abc"}, recorded_at=past)
    now = datetime.now(timezone.utc)
    eraser.register({"user_hash": "def"}, recorded_at=now)

    traces = eraser.active_traces()
    assert len(traces) == 1
    assert traces[0]["payload"]["user_hash"] == "def"

    cleared = eraser.erase_all()
    assert cleared == 1
    assert eraser.active_traces() == []


def test_manual_erase_resets_privacy_state() -> None:
    shield = PrivacyIntegrityShield(eraser=VaultTraceEraser(expiration_seconds=60.0))
    shield.grant_consent("ghost", "token-one")
    shield.register_unlock("ghost", "unlock-one")
    shield.toggle_tracking(True)
    recorded = shield.track_event("ghost", {"note": "capture"}, category="compliance")
    assert recorded is not None
    assert shield.status()["active_traces"]

    shield.manual_erase()
    assert shield.status()["active_traces"] == []
