from __future__ import annotations

import pytest

from vaultfire.security.fhe import Ciphertext, FHECipherSuite, PlaceholderFHEBackend


def test_privacy_engine_consent_and_staking_toggle():
    suite = FHECipherSuite()
    engine = suite.privacy_engine

    ciphertext, proof = engine.consent.encrypt_with_consent(
        42.5,
        participant_id="validator.alpha",
        consent_scope="staking::alpha",
        metadata={"purpose": "initial-stake"},
    )

    assert isinstance(ciphertext, Ciphertext)
    assert engine.consent.verify_proof(proof)

    with pytest.raises(RuntimeError):
        engine.staking.encrypt_stake(1.0)

    engine.staking.enable(proof)
    assert engine.staking.is_enabled

    stake_ct = engine.staking.encrypt_stake(12.5, metadata={"epoch": 1})
    assert isinstance(stake_ct, Ciphertext)
    assert stake_ct.metadata["consent_proof"] == proof.proof_hash

    engine.staking.disable()
    assert not engine.staking.is_enabled


def test_privacy_engine_backend_upgrade_swap_ready():
    suite = FHECipherSuite()
    engine = suite.privacy_engine

    class DummyBackend(PlaceholderFHEBackend):
        backend_id = "vaultfire.fhe.dummy-upgrade"

        def __init__(self, modulus: int) -> None:
            super().__init__(modulus=modulus)

    suite.upgrade_backend(DummyBackend(modulus=suite.modulus))
    assert suite.backend_id == "vaultfire.fhe.dummy-upgrade"

    ciphertext, proof = engine.consent.encrypt_with_consent(
        11.0,
        participant_id="validator.beta",
        consent_scope="staking::beta",
    )

    assert proof.metadata["backend_id"] == "vaultfire.fhe.dummy-upgrade"
    assert engine.consent.verify_proof(proof)

    engine.staking.enable(proof)
    stake_ct = engine.staking.encrypt_stake(6.5)
    assert stake_ct.metadata["backend"] == "vaultfire.fhe.dummy-upgrade"

    key = engine.keys.generate("validator.beta", consent_proof=proof)
    assert key.metadata["backend"] == "vaultfire.fhe.dummy-upgrade"

    disclosure = engine.disclosure.prepare_disclosure(
        stake_ct,
        auditor_id="auditor.one",
        conditions={"window": "epoch-1"},
        consent_proof=proof,
    )
    assert disclosure.metadata["backend"] == "vaultfire.fhe.dummy-upgrade"
    assert disclosure.consent_reference == proof.proof_hash
