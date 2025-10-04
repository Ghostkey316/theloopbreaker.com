import pytest

from vaultfire.protocol.consent_mirror import ConsentMirror


def test_partner_consent_mirroring_flow():
    manifest = {"ethics_framework": "ghostkey"}
    consent = ConsentMirror(
        public_manifest=manifest,
        usage_scope="Loyalty, Trust Scoring, Yield Distribution",
    )

    record = consent.register_partner("partner.one", consent_hash="consent123")
    assert record.manifest["consent_hash"] == "consent123"
    assert record.manifest["architect_wallet"] == "bpow20.cb.id"

    mirrored = consent.mirror_beliefs("partner.one", signal={"score": 0.91})
    assert mirrored["signal"]["score"] == 0.91
    assert mirrored["origin_node"] == "Ghostkey-316"

    with pytest.raises(PermissionError):
        consent.mirror_beliefs("partner.two", signal={})
