from __future__ import annotations

from datetime import datetime, timezone

import pytest

from vaultfire.identity import (
    AnchorRecord,
    AuthorshipBurnRecord,
    ContributionRecord,
    GenesisRegistration,
    MetadataRecord,
    SignalAnchorError,
    anchor_signal_origin,
    burn_authorship_trace,
    get_signal_anchor_state,
    record_originator_metadata,
    register_genesis_node,
    reset_signal_anchor_state,
    timestamp_contribution_start,
)
from vaultfire.protocol.constants import ARCHITECT_WALLET, ORIGIN_NODE_ID


@pytest.fixture(autouse=True)
def reset_anchor_state() -> None:
    reset_signal_anchor_state()


def test_anchor_signal_origin_normalises_inputs() -> None:
    record = anchor_signal_origin("Ghostkey316", ARCHITECT_WALLET.upper())
    assert isinstance(record, AnchorRecord)
    assert record.origin_id == ORIGIN_NODE_ID
    assert record.wallet_id == ARCHITECT_WALLET

    same = anchor_signal_origin(ORIGIN_NODE_ID, ARCHITECT_WALLET)
    assert same is record


def test_anchor_signal_origin_rejects_conflicting_wallet() -> None:
    anchor_signal_origin(ORIGIN_NODE_ID, ARCHITECT_WALLET)
    with pytest.raises(SignalAnchorError):
        anchor_signal_origin(ORIGIN_NODE_ID, "wallet.two")


def test_timestamp_contribution_start_parses_iso_datetime() -> None:
    anchor_signal_origin(ORIGIN_NODE_ID, ARCHITECT_WALLET)
    timestamp = "2025-07-06T11:00:00-04:00"
    record = timestamp_contribution_start("Ghostkey316", timestamp)
    assert isinstance(record, ContributionRecord)
    assert record.origin_id == ORIGIN_NODE_ID
    assert record.started_at == datetime(2025, 7, 6, 15, 0, tzinfo=timezone.utc)

    same = timestamp_contribution_start(ORIGIN_NODE_ID, record.started_at)
    assert same.started_at == record.started_at


def test_record_originator_metadata_tracks_latest_entry() -> None:
    entry = record_originator_metadata(name="Ghostkey-316", wallet=ARCHITECT_WALLET)
    assert isinstance(entry, MetadataRecord)
    assert entry.wallet == ARCHITECT_WALLET
    assert entry.name == "Ghostkey-316"

    state = get_signal_anchor_state()
    stored = state["metadata"][ARCHITECT_WALLET.lower()]
    assert stored["name"] == "Ghostkey-316"


def test_burn_authorship_trace_requires_anchor() -> None:
    with pytest.raises(SignalAnchorError):
        burn_authorship_trace(ORIGIN_NODE_ID)

    anchor_signal_origin(ORIGIN_NODE_ID, ARCHITECT_WALLET)
    burn = burn_authorship_trace("Ghostkey316")
    assert isinstance(burn, AuthorshipBurnRecord)
    assert burn.origin_id == ORIGIN_NODE_ID


def test_register_genesis_node_requires_preconditions() -> None:
    anchor_signal_origin(ORIGIN_NODE_ID, ARCHITECT_WALLET)
    with pytest.raises(SignalAnchorError):
        register_genesis_node(ORIGIN_NODE_ID)

    timestamp_contribution_start(ORIGIN_NODE_ID, datetime(2025, 7, 6, 15, 0, tzinfo=timezone.utc))
    registration = register_genesis_node("Ghostkey316")
    assert isinstance(registration, GenesisRegistration)
    assert registration.origin_id == ORIGIN_NODE_ID


def test_register_genesis_node_records_snapshot() -> None:
    anchor_signal_origin(ORIGIN_NODE_ID, ARCHITECT_WALLET)
    timestamp_contribution_start(ORIGIN_NODE_ID, datetime.now(timezone.utc))
    register_genesis_node(ORIGIN_NODE_ID)

    snapshot = get_signal_anchor_state()
    assert ORIGIN_NODE_ID in snapshot["genesis_nodes"]
