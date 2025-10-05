from __future__ import annotations

import math

from vaultfire.security.fhe import AuroraFHEBackend, Ciphertext, FHECipherSuite


def test_aurora_backend_encrypts_and_decrypts_scalar():
    backend = AuroraFHEBackend()
    suite = FHECipherSuite(backend=backend)

    ciphertext = suite.encrypt_value(12.75)
    assert isinstance(ciphertext, Ciphertext)
    assert ciphertext.metadata["backend"] == backend.backend_id
    assert "nonce" in ciphertext.metadata

    value = suite.decrypt_value(ciphertext)
    assert math.isclose(value, 12.75, rel_tol=1e-6, abs_tol=1e-6)


def test_aurora_backend_supports_homomorphic_add_and_reblind():
    suite = FHECipherSuite()
    ct_one = suite.encrypt_value(5.0, metadata={"label": "a"})
    ct_two = suite.encrypt_value(7.0, metadata={"label": "b"})

    aggregate = suite.homomorphic_add(ct_one, ct_two)
    assert aggregate.metadata["type"] == "aggregate"
    assert aggregate.metadata["inputs"] == 2

    decrypted = suite.decrypt_value(aggregate)
    assert math.isclose(decrypted, 12.0, rel_tol=1e-6, abs_tol=1e-6)

    refreshed = suite.reblind(aggregate)
    assert refreshed.mask != aggregate.mask
    assert refreshed.metadata.get("reblinded") is True


def test_aurora_backend_generates_attestations():
    suite = FHECipherSuite()
    ciphertexts = [suite.encrypt_value(idx) for idx in (1.0, 2.0, 3.0)]

    attestation = suite.attest_integrity(ciphertexts)
    assert attestation["backend"] == "vaultfire.aurora-fhe-r1"
    assert attestation["count"] == 3
    assert isinstance(attestation["attestation"], str)
    assert len(attestation["attestation"]) == 64
