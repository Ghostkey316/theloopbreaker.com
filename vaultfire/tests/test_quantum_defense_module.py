import json
from pathlib import Path

import pytest

from vaultfire.quantum import (
    PQCSchemeConfig,
    QuantumDefenseTestSuite,
    QuantumIdentityEngine,
    SentinelFirewall,
    VaultfireQuantumDefenseModule,
    YieldShield,
)


@pytest.fixture()
def sample_pqc_config() -> PQCSchemeConfig:
    return PQCSchemeConfig(
        kyber_level="Kyber768",
        dilithium_level="Dilithium3",
        falcon_enabled=True,
        preferred_library="pqcrypto-js",
    )


def test_hybrid_profile_and_dual_stack(sample_pqc_config: PQCSchemeConfig) -> None:
    profile = sample_pqc_config.hybrid_profile()
    requirements = sample_pqc_config.dual_stack_requirements()

    assert profile["primary"] == "Kyber768"
    assert profile["signature"] == "Dilithium3"
    assert profile["alternate_signature"] == "Falcon"
    assert requirements["falcon"] == "Falcon-Enabled"


def test_identity_engine_wraps_biometrics(sample_pqc_config: PQCSchemeConfig) -> None:
    engine = QuantumIdentityEngine(sample_pqc_config)
    proof = engine.wrap_biometric_signature(
        "ghostkey-316", biometric_sample="retina-scan", entropy_salt="vaultfire"
    )

    assert proof.fhe_ready is True
    assert proof.pqc_public_key.startswith("pqc-")
    assert proof.zk_snark_proof.startswith("zk-")
    assert proof.state_commitment.startswith("commit-")


def test_yield_shield_envelope_and_receipt(sample_pqc_config: PQCSchemeConfig) -> None:
    shield = YieldShield(sample_pqc_config)
    payload = {"amount": 42, "asset": "GHOST"}
    envelope = shield.wrap_yield_claim("claim-001", payload)
    receipt = shield.rollup_receipt(envelope)

    assert envelope.lattice_tag.startswith("lattice-")
    assert sample_pqc_config.kyber_level in envelope.encrypted_payload
    assert receipt["channel"] == "zk-rollup-sequencer"
    assert receipt["fallback_log"] == envelope.merkle_fallback_root


def test_sentinel_firewall_enforces_dual_stack(sample_pqc_config: PQCSchemeConfig) -> None:
    firewall = SentinelFirewall(sample_pqc_config, noise_threshold=0.5)
    missing = firewall.assess_request(
        "bridge-001", signatures={"kyber_signature": "sig-kyber"}, metadata={}
    )
    assert missing.accepted is False
    assert "Missing PQ signatures" in missing.reason

    noisy = firewall.assess_request(
        "bridge-002",
        signatures={"kyber_signature": "sig-kyber", "falcon_signature": "sig-falcon"},
        metadata={"side_channel_noise": 0.75},
    )
    assert noisy.accepted is False
    assert noisy.reason == "Side-channel noise exceeds threshold"

    clear = firewall.assess_request(
        "bridge-003",
        signatures={"kyber_signature": "sig-kyber", "falcon_signature": "sig-falcon"},
        metadata={"side_channel_noise": 0.1},
    )
    assert clear.accepted is True
    assert clear.reason.startswith("Bridge request cleared")


def test_quantum_defense_module_generates_manifest(tmp_path: Path) -> None:
    config = PQCSchemeConfig(falcon_enabled=True)
    module = VaultfireQuantumDefenseModule(pqc_config=config)

    manifest = module.activate(
        label="GHOSTKEY-316_QRM_LOCKED",
        subject="ghostkey-identity",
        biometric_sample="fingerprint",
        entropy_salt="sentinel",
        claim_id="claim-009",
        yield_payload={"reward": "quantum-yield", "value": 316},
        bridge_request={
            "request_id": "bridge-quantum",
            "signatures": {"kyber_signature": "sig-kyber", "falcon_signature": "sig-falcon"},
            "metadata": {"side_channel_noise": 0.05},
        },
        registry_path=tmp_path / "manifest.json",
    )

    stored = json.loads((tmp_path / "manifest.json").read_text())

    assert manifest.label == "GHOSTKEY-316_QRM_LOCKED"
    assert manifest.firewall["accepted"] is True
    assert stored["test_suite"] == QuantumDefenseTestSuite().coverage_commands()
    assert stored["attack_simulations"] == QuantumDefenseTestSuite.simulated_attacks()
    assert stored["yield_envelope"]["rollup_channel"] == "zk-rollup-sequencer"
    assert stored["identity"]["state_commitment"].startswith("commit-")
