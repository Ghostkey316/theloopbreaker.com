from __future__ import annotations

from datetime import datetime, timezone

import pytest

from vaultfire.protocol.constants import MISSION_STATEMENT
from vaultfire.protocol.mission_anchor import MissionAnchorRecord
from vaultfire.protocol.mission_covenant import MissionCovenantLedger


def _make_anchor(partner_id: str = "partner-001") -> MissionAnchorRecord:
    return MissionAnchorRecord(
        partner_id=partner_id,
        mission=MISSION_STATEMENT,
        commitments=("ethics", "wallet-only"),
        signature=f"signature::{partner_id}",
        anchored_at=datetime.now(timezone.utc),
        resonance=0.92,
        purposeful_request={"belief_density": 0.81, "empathy_score": 0.77},
        purposeful_trace={"approved": True},
        telemetry_hooks=(
            f"telemetry::timestamp::{datetime.now(timezone.utc).isoformat()}",
            "telemetry::location::ghostline-a9f",
            "telemetry::signal::vector-alpha",
        ),
        regenerative_identity={
            "reissue_tags": [f"regen::{partner_id}"],
            "fallback_tokens": ["ghostkey316::stealth"],
            "status_flag": "active",
        },
        resilience_stack=(
            "temporal_resonance_guard",
            "quantum_shadow_buffer",
            "consent_token_exchange",
        ),
    )


def test_mission_covenant_chain_establishes_foundation() -> None:
    ledger = MissionCovenantLedger()
    anchor = _make_anchor()
    ledger.register_anchor(anchor)

    covenant = ledger.issue_covenant(
        anchor.partner_id,
        purpose="guardian-lineage",
        commitments=["wallet-only", "ethics", "mission-mirroring"],
        metadata={"scope": "pilot", "tier": "guardian"},
    )

    assert covenant.mission == MISSION_STATEMENT
    assert covenant.previous_unstoppable == ""
    assert ledger.verify_covenant(covenant)
    assert ledger.foundation_digest == covenant.unstoppable_hash

    exported = covenant.export()
    assert exported["mission_lineage"] == covenant.mission_lineage
    assert exported["metadata"]["scope"] == "pilot"


def test_mission_covenant_requires_canonical_mission() -> None:
    ledger = MissionCovenantLedger()
    anchor = _make_anchor("partner-002")
    ledger.register_anchor(anchor)

    with pytest.raises(ValueError):
        ledger.issue_covenant(
            anchor.partner_id,
            purpose="rogue",
            commitments=["ethics"],
            mission_override="Different mission entirely",
        )


def test_mission_covenant_chain_links_unstoppable_hashes() -> None:
    ledger = MissionCovenantLedger()
    anchor = _make_anchor("partner-003")
    ledger.register_anchor(anchor)

    first = ledger.issue_covenant(
        anchor.partner_id,
        purpose="activation",
        commitments=["ethics"],
    )
    second = ledger.issue_covenant(
        anchor.partner_id,
        purpose="scale",
        commitments=["ethics", "guardian"],
        metadata={"phase": 2},
    )

    assert second.previous_unstoppable == first.unstoppable_hash
    assert ledger.foundation_digest == second.unstoppable_hash
    assert ledger.verify_covenant(second.covenant_id)
