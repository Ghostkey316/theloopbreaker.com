# Reference: ethics/core.mdx
"""Vaultfire engine package."""

from .identity_resolver import resolve_identity, resolve_ens, resolve_cb_id
from .partner_hooks import record_usage, grant_reward
from .revenue_hooks import record_contract_revenue, distribute_revenue
from .marketplace_plugins import (
    opensea_asset_url,
    github_sponsors_url,
    dapp_store_url,
    record_link,
    fetch_json,
)

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
]
