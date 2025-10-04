import pytest

from vaultfire.protocol.reputation_tokens import ReputationLedger
from vaultfire.security.fhe import FHECipherSuite


def test_reputation_tokens_are_soulbound_and_encrypted():
    ledger = ReputationLedger(cipher_suite=FHECipherSuite())
    manifest = {"ethics_framework": "ghostkey", "architect": "bpow20.cb.id"}
    token = ledger.mint(wallet="aligned.eth", score=0.97, manifest=manifest)

    assert token.proof["context"] == "sbt::aligned.eth"
    assert token.manifest["ethics_framework"] == "ghostkey"
    assert ledger.get_token("aligned.eth") is token

    with pytest.raises(ValueError):
        ledger.mint(wallet="aligned.eth", score=0.5, manifest=manifest)

    with pytest.raises(PermissionError):
        ledger.transfer("aligned.eth", "other.eth")
