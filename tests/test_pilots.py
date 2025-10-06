from __future__ import annotations

from datetime import datetime

import pytest

from vaultfire.pilots import SecretTestNodeDeployment, deploy_secret_test_node


def test_deploy_secret_test_node_returns_expected_summary():
    result = deploy_secret_test_node(
        node_name="Ghostkey-Pilot-Access",
        wallet="bpow20.cb.id",
        visibility="stealth",
        status="live",
        eligible_partners=["AssembleAI", "NS3", "Worldcoin", "OpenAI"],
        return_feedback=True,
        yield_tied=True,
    )

    assert isinstance(result, SecretTestNodeDeployment)
    assert result.node_name == "Ghostkey-Pilot-Access"
    assert result.wallet == "bpow20.cb.id"
    assert result.visibility == "stealth"
    assert result.status == "live"
    assert result.eligible_partners == (
        "AssembleAI",
        "NS3",
        "Worldcoin",
        "OpenAI",
    )
    assert result.return_feedback is True
    assert result.yield_tied is True
    assert len(result.handshake_token) == 24
    # Ensure the issued timestamp is ISO 8601 parseable.
    assert datetime.fromisoformat(result.issued_at)


def test_deploy_secret_test_node_normalizes_partners_and_handshake():
    first = deploy_secret_test_node(
        node_name="Ghostkey-Pilot-Access",
        wallet="bpow20.cb.id",
        visibility="stealth",
        status="live",
        eligible_partners=["  AssembleAI  ", "NS3", "assembleai", "OpenAI"],
        return_feedback=True,
        yield_tied=False,
    )
    second = deploy_secret_test_node(
        node_name="Ghostkey-Pilot-Access",
        wallet="bpow20.cb.id",
        visibility="stealth",
        status="live",
        eligible_partners=["AssembleAI", "NS3", "OpenAI"],
        return_feedback=True,
        yield_tied=False,
    )

    assert first.eligible_partners == ("AssembleAI", "NS3", "OpenAI")
    assert first.handshake_token == second.handshake_token


def test_deploy_secret_test_node_requires_non_empty_fields() -> None:
    with pytest.raises(ValueError):
        deploy_secret_test_node(
            node_name="",
            wallet="wallet",
            visibility="stealth",
            status="live",
            eligible_partners=["One"],
            return_feedback=True,
            yield_tied=True,
        )

    with pytest.raises(ValueError):
        deploy_secret_test_node(
            node_name="Node",
            wallet=" ",
            visibility="stealth",
            status="live",
            eligible_partners=["One"],
            return_feedback=True,
            yield_tied=True,
        )


def test_deploy_secret_test_node_requires_partners() -> None:
    with pytest.raises(ValueError):
        deploy_secret_test_node(
            node_name="Node",
            wallet="wallet",
            visibility="stealth",
            status="live",
            eligible_partners=[],
            return_feedback=True,
            yield_tied=True,
        )

def test_deploy_secret_test_node_rejects_unknown_modes() -> None:
    with pytest.raises(ValueError):
        deploy_secret_test_node(
            node_name="Node",
            wallet="wallet",
            visibility="shadow",
            status="live",
            eligible_partners=["One"],
            return_feedback=True,
            yield_tied=True,
        )

    with pytest.raises(ValueError):
        deploy_secret_test_node(
            node_name="Node",
            wallet="wallet",
            visibility="stealth",
            status="unknown",
            eligible_partners=["One"],
            return_feedback=True,
            yield_tied=True,
        )
