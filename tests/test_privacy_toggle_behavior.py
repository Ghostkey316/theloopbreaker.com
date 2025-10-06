from __future__ import annotations

from vaultfire.privacy_integrity import PrivacyIntegrityShield


def test_privacy_toggle_behavior() -> None:
    shield = PrivacyIntegrityShield()
    shield.grant_consent("ghost", "token-123")
    shield.register_unlock("ghost", "unlock-seed")

    payload = {"event": "pulse", "intensity": 0.92}
    assert shield.track_event("ghost", payload, category="diagnostic") is None

    shield.toggle_tracking(True)
    recorded = shield.track_event("ghost", payload, category="diagnostic")
    assert recorded is not None
    assert recorded.get("user_hash")
    assert recorded.get("telemetry_enabled") is True
    assert recorded.get("category") == "diagnostic"

    shield.toggle_tracking(False)
    assert shield.track_event("ghost", payload, category="diagnostic") is None
    assert shield.status()["telemetry_enabled"] is False
