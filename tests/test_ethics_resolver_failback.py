"""Audit fallback tests for the consent relay graph."""

from datetime import datetime, timezone

from consent_relay_graph import ConsentRelayGraph
from vaultfire.protocol.constants import MISSION_STATEMENT
from vaultfire.protocol.mission_covenant import MissionCovenantLedger
from vaultfire.protocol.mission_anchor import MissionAnchorRecord


def _anchor_record(partner_id: str) -> MissionAnchorRecord:
    return MissionAnchorRecord(
        partner_id=partner_id,
        mission=MISSION_STATEMENT,
        commitments=("ethics-first",),
        signature=f"sig::{partner_id}",
        anchored_at=datetime.now(timezone.utc),
        resonance=0.99,
        purposeful_request={"partner": partner_id},
        purposeful_trace={},
        telemetry_hooks=("telemetry_compliance",),
        regenerative_identity={"wallet": partner_id},
        resilience_stack=("edge_trust_pods",),
    )


def test_consent_relay_graph_enforces_covenants():
    ledger = MissionCovenantLedger()
    anchor = _anchor_record("ally.alpha")
    ledger.register_anchor(anchor)
    covenant = ledger.issue_covenant("ally.alpha", purpose="ally", commitments=["ethics-first"])

    graph = ConsentRelayGraph(mission_ledger=ledger, debug=True)
    graph.register_covenant(covenant)

    result = graph.route_signal(
        "ally.alpha",
        "vaultfire.module",
        "deploy",
        metadata={"consent": True},
        persona_traits={"mood": "curious"},
    )

    assert result.partner_id == "ally.alpha"
    assert result.covenant_id == covenant.covenant_id
    assert result.persona.wallet_origin == "bpow20.cb.id"
    assert result.scrambled_signal.wallet_origin == "bpow20.cb.id"
    assert result.decoy_route.wallet_origin == "bpow20.cb.id"
    assert result.decoy_route.ghost_identity.startswith("Ghostkey-316::")

    audit = graph.audit_trail()
    assert result.audit_reference in audit


def test_consent_relay_graph_rejects_without_consent():
    graph = ConsentRelayGraph()

    try:
        graph.route_signal("unknown", "module", "action")
    except PermissionError:
        pass
    else:
        raise AssertionError("Expected PermissionError for unknown partner")
