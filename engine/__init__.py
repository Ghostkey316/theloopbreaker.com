# Reference: ethics/core.mdx
"""Vaultfire engine package."""

from .identity_resolver import resolve_identity, resolve_ens, resolve_cb_id
from .partner_hooks import record_usage, grant_reward
from .revenue_hooks import record_contract_revenue, distribute_revenue
from .passive_yield_simulator import simulate_passive_yield
from .loyalty_engine import loyalty_score, update_loyalty_ranks
from .loyalty_multiplier import loyalty_multiplier
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
from .ens_sync_status import read_sync_status
from .public_health_matcher import match_symptom
from .biofeedback import record_biofeedback, fetch_from_provider, get_latest_biofeedback
from .health_node import recommendations as health_recommendations
from .wellness_oracle import (
    record_sleep,
    record_hydration,
    record_checkin,
    wellness_guidance,
    generate_health_quest,
)
from .healing_trust_engine import rank_healing_methods, reward_top_contributors
from .curewatch import flag_effective_patterns
from .cure_locker import submit_cure, list_cures, vote_cure, tally_votes
from .gaming_layer import create_session, join_session, end_session
from .avatar_sync import sync_avatar, get_avatar
from .inventory_storage import add_item, list_items
from .ens_overlay import overlay_identity, resolve_overlay
from .game_logger import log_outcome
from .avatar_mirror import record_avatar_event, get_mirrored_profile
from .health_sync_engine import (
    link_wearable_data,
    get_wearable_data,
    link_journal_entry,
    get_journal_entries,
)
from .genesync import (
    link_gene_metrics,
    get_gene_metrics,
    gene_risk_level,
    GENESYNC_WARNING,
)
from .modding_layer import create_module, list_modules, upvote_module
from .auto_mirror_airdrop import scan_public_activity, execute_airdrop, run_airdrop
from .planetkeeper import (
    opt_in as planetkeeper_opt_in,
    is_opted_in as planetkeeper_enabled,
    record_eco_action,
    eco_multiplier,
    award_planetkeeper_badge,
    public_impact as planetkeeper_public,
    carbon_offset_status,
    energy_device_report,
    pledge_commitment,
)
from .purpose_engine import (
    record_traits,
    discover_purpose,
    generate_purpose_quest,
    adaptive_purpose_quest,
    suggest_partner_communities,
    tailor_experience,
    analyze_actions,
    moral_memory_mirror,
    simulate_life_path,
    commit_life_path,
)
from .synced_soul_compass import update_soul_compass
from .archetype_mirror import train_archetype_guide, get_archetype_guide
from .reflection_layer import update_emotional_state, emotion_trend
from .gamified_yield_layer import (
    get_daily_tasks,
    complete_task,
    quest_card,
    add_streak_protection,
)
from .fit_ai_coach import record_workout, coach_feedback
from .vaultwear import sync_wearable
from .vaultlink import (
    onboard_companion,
    record_interaction,
    fetch_state as fetch_vaultlink_state,
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
    "simulate_passive_yield",
    "loyalty_score",
    "update_loyalty_ranks",
    "loyalty_multiplier",
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
    "read_sync_status",
    "match_symptom",
    "record_biofeedback",
    "fetch_from_provider",
    "get_latest_biofeedback",
    "record_sleep",
    "record_hydration",
    "record_checkin",
    "wellness_guidance",
    "generate_health_quest",
    "health_recommendations",
    "rank_healing_methods",
    "reward_top_contributors",
    "flag_effective_patterns",
    "submit_cure",
    "list_cures",
    "vote_cure",
    "tally_votes",
    "create_session",
    "join_session",
    "end_session",
    "sync_avatar",
    "get_avatar",
    "add_item",
    "list_items",
    "overlay_identity",
    "resolve_overlay",
    "log_outcome",
    "record_avatar_event",
    "get_mirrored_profile",
    "link_wearable_data",
    "get_wearable_data",
    "link_journal_entry",
    "get_journal_entries",
    "link_gene_metrics",
    "get_gene_metrics",
    "gene_risk_level",
    "GENESYNC_WARNING",
    "create_module",
    "list_modules",
    "upvote_module",
    "scan_public_activity",
    "execute_airdrop",
    "run_airdrop",
    "record_traits",
    "discover_purpose",
    "generate_purpose_quest",
    "adaptive_purpose_quest",
    "suggest_partner_communities",
    "tailor_experience",
    "analyze_actions",
    "moral_memory_mirror",
    "simulate_life_path",
    "commit_life_path",
    "update_soul_compass",
    "train_archetype_guide",
    "get_archetype_guide",
    "update_emotional_state",
    "emotion_trend",
    "get_daily_tasks",
    "complete_task",
    "quest_card",
    "add_streak_protection",
    "planetkeeper_opt_in",
    "planetkeeper_enabled",
    "record_eco_action",
    "eco_multiplier",
    "award_planetkeeper_badge",
    "planetkeeper_public",
    "carbon_offset_status",
    "energy_device_report",
    "pledge_commitment",
    "record_workout",
    "coach_feedback",
    "sync_wearable",
    "onboard_companion",
    "record_interaction",
    "fetch_vaultlink_state",
]

