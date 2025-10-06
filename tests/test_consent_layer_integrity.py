from __future__ import annotations

import pytest

from vaultfire.privacy import PrivacyError
from vaultfire.privacy_integrity import ConsentGuardianLayer


def test_consent_layer_requires_active_unlock_and_consent() -> None:
    guardian = ConsentGuardianLayer()

    with pytest.raises(PrivacyError):
        guardian.log_event("ghost", {"value": 1})

    fingerprint = guardian.grant_consent("ghost", "token-abc", expires_in=60)
    assert fingerprint

    with pytest.raises(PrivacyError):
        guardian.log_event("ghost", {"value": 2})

    unlock_fingerprint = guardian.register_unlock("ghost", "unlock-code")
    assert unlock_fingerprint

    event = guardian.log_event("ghost", {"value": 3})
    assert event["user_hash"] == fingerprint
    assert event["payload"] == {"value": 3}

    status = guardian.status()
    assert "ghost" in status["consents"]
    assert "ghost" in status["unlocks"]

    guardian.revoke_consent("ghost")
    assert guardian.has_consent("ghost") is False
