import pytest

from vaultfire.token import build_governance_token_spec


SPEC_FIXTURE = {
    "token": {
        "name": "Vaultfire Governance Token",
        "symbol": "VLT",
        "standard": "ERC-20-compatible",
        "chain_targets": ["Base", "Ethereum", "Base"],
        "supply_cap": "1_000_000_000",
        "emissions_curve": "logarithmic_decay",
    },
    "governance": {
        "quorum": "15%",
        "voting_delay": "1 day",
        "proposal_threshold": "10_000 VLT",
    },
    "ethics": {
        "proof_of_purpose_required": True,
        "public_audit_interval_days": 90,
    },
}


def test_governance_token_manifest_roundtrip():
    spec = build_governance_token_spec(SPEC_FIXTURE)
    manifest = spec.to_manifest()

    assert manifest["token"]["name"] == "Vaultfire Governance Token"
    assert manifest["token"]["symbol"] == "VLT"
    assert manifest["token"]["chain_targets"] == ["Base", "Ethereum"]
    assert manifest["token"]["supply_cap"] == 1_000_000_000
    assert manifest["governance"]["quorum"]["fraction"] == pytest.approx(0.15)
    assert manifest["governance"]["proposal_threshold"]["amount"] == 10_000
    assert manifest["governance"]["proposal_threshold"]["denomination"] == "VLT"
    assert manifest["governance"]["voting_delay"]["seconds"] == 86_400
    assert manifest["governance"]["voting_delay"]["iso_8601"] == "P1D"
    assert manifest["ethics"]["proof_of_purpose_required"] is True
    assert manifest["ethics"]["public_audit_interval_days"] == 90
    assert len(manifest["checksum"]) == 64


def test_governance_token_spec_validates_inputs():
    invalid_spec = {
        "token": SPEC_FIXTURE["token"],
        "governance": {**SPEC_FIXTURE["governance"], "proposal_threshold": "5_000 OTHER"},
        "ethics": SPEC_FIXTURE["ethics"],
    }

    with pytest.raises(ValueError):
        build_governance_token_spec(invalid_spec)


def test_governance_token_spec_requires_boolean_ethics():
    invalid_spec = {
        "token": SPEC_FIXTURE["token"],
        "governance": SPEC_FIXTURE["governance"],
        "ethics": {**SPEC_FIXTURE["ethics"], "proof_of_purpose_required": "yes"},
    }

    with pytest.raises(TypeError):
        build_governance_token_spec(invalid_spec)
