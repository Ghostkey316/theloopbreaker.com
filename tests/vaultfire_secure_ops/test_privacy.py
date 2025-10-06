from __future__ import annotations

import pytest

from vaultfire.privacy import PrivacyError, QuantumSecureCipherSuite


def test_secure_session_enforces_plaintext_controls():
    suite = QuantumSecureCipherSuite()
    with suite.secure_session() as session:
        ct1 = session.encrypt_structured(("signal", "value"), {"signal": 1.25, "value": 4.0})
        ct2 = session.encrypt_structured(("signal", "value"), {"signal": 2.0, "value": 6.0})
        combined = session.aggregate([ct1, ct2])
        assert combined.metadata["aggregate"] is True
        with pytest.raises(PrivacyError):
            session.decrypt_structured(combined)
    # Session closed: any further operations should fail
    with pytest.raises(PrivacyError):
        session.decrypt_structured(ct1)  # type: ignore[name-defined]

    with suite.secure_session(allow_plaintext=True) as privileged:
        ciphertext = privileged.encrypt_structured(("signal", "value"), {"signal": 0.5, "value": 1.5})
        scaled = privileged.rescale(ciphertext, factor=2.0)
        result = privileged.decrypt_structured(scaled)
        assert "approximate_value" in result
        assert isinstance(result["approximate_value"], float)
