import pytest

from vaultfire.security.access_guard import (
    MAX_UNVERIFIED_RATE_PER_MINUTE,
    AccessDecision,
    evaluate_access_rate,
)


class DummyVerifier:
    def __init__(self, *, verified_wallets=None):
        self._verified = {w.lower() for w in (verified_wallets or [])}

    def verified(self, wallet: str) -> bool:
        return wallet.lower() in self._verified


def test_unverified_wallet_above_threshold_triggers_ban():
    verifier = DummyVerifier()
    reasons = []

    def ban(reason):
        reasons.append(reason)

    decision = evaluate_access_rate(
        "ghost123.eth",
        MAX_UNVERIFIED_RATE_PER_MINUTE + 5,
        verifier=verifier,
        ban_user=ban,
    )

    assert reasons == ["ghost_attempt_detected"]
    assert isinstance(decision, AccessDecision)
    assert decision.status == "banned"
    assert decision.reason == "ghost_attempt_detected"
    assert decision.verified is False


def test_verified_wallet_not_banned_even_with_high_rate():
    verifier = DummyVerifier(verified_wallets={"guardian.eth"})
    reasons = []

    decision = evaluate_access_rate(
        "guardian.eth",
        MAX_UNVERIFIED_RATE_PER_MINUTE + 20,
        verifier=verifier,
        ban_user=lambda _: reasons.append("called"),
    )

    assert reasons == []
    assert decision.status == "allowed"
    assert decision.verified is True
    assert decision.reason is None


def test_negative_rate_rejected():
    verifier = DummyVerifier()

    with pytest.raises(ValueError):
        evaluate_access_rate(
            "ghost123.eth",
            -1,
            verifier=verifier,
            ban_user=lambda _: None,
        )


def test_rate_within_limit_allows_unverified_wallet():
    verifier = DummyVerifier()
    reasons = []

    decision = evaluate_access_rate(
        "ghost123.eth",
        MAX_UNVERIFIED_RATE_PER_MINUTE,
        verifier=verifier,
        ban_user=lambda reason: reasons.append(reason),
    )

    assert reasons == []
    assert decision.status == "allowed"
    assert decision.verified is False
    assert decision.reason is None

