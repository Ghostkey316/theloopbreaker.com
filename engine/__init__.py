# Reference: ethics/core.mdx
"""Vaultfire engine package."""

from .identity_resolver import resolve_identity, resolve_ens, resolve_cb_id
from .partner_hooks import record_usage, grant_reward
from .revenue_hooks import record_contract_revenue, distribute_revenue
from .passive_yield_simulator import simulate_passive_yield
from .marketplace_plugins import (
    opensea_asset_url,
    github_sponsors_url,
    dapp_store_url,
    record_link,
    fetch_json,
)
from .contributor_identity import (
    sync_identity,
    identity_summary,
    retroactive_bonus,
)
from .self_audit import run_self_audit
from .target_lock import (
    set_target_lock,
    exit_target_lock,
    update_value as update_target_value,
    claim_bonus as claim_target_bonus,
)
from .ethics_filter import rank_listings
from .shutdown_manager import (
    initiate_shutdown_vote,
    cast_vote as cast_shutdown_vote,
    tally_votes as tally_shutdown_votes,
)
from .signal_reward import reward_signal_event

__all__ = [
    "resolve_identity",
    "resolve_ens",
    "resolve_cb_id",
    "record_usage",
    "grant_reward",
    "record_contract_revenue",
    "distribute_revenue",
    "opensea_asset_url",
    "github_sponsors_url",
    "dapp_store_url",
    "record_link",
    "fetch_json",
    "simulate_passive_yield",
    "sync_identity",
    "identity_summary",
    "retroactive_bonus",
    "run_self_audit",
    "set_target_lock",
    "exit_target_lock",
    "update_target_value",
    "claim_target_bonus",
    "rank_listings",
    "initiate_shutdown_vote",
    "cast_shutdown_vote",
    "tally_shutdown_votes",
    "reward_signal_event",
]
