"""Vaultfire Gaming SDK exposing game session utilities."""

from engine.gaming_layer import create_session, join_session, end_session
from engine.avatar_sync import sync_avatar, get_avatar
from engine.avatar_mirror import record_avatar_event, get_mirrored_profile
from engine.inventory_storage import add_item, list_items
from engine.ens_overlay import overlay_identity, resolve_overlay
from engine.game_replay import record_replay_action, finalize_replay
from vaultfire_arcade.guest_progress import merge_guest_progress

__all__ = [
    "create_session",
    "join_session",
    "end_session",
    "sync_avatar",
    "get_avatar",
    "record_avatar_event",
    "get_mirrored_profile",
    "add_item",
    "list_items",
    "overlay_identity",
    "resolve_overlay",
    "record_replay_action",
    "finalize_replay",
]

class VaultfireGameSDK:
    """High-level wrapper for Vaultfire game features."""

    def __init__(self, partner_id: str):
        self.partner_id = partner_id

    def new_game(self, game_id: str, metadata: dict | None = None):
        return create_session(game_id, self.partner_id, metadata)

    def join(self, game_id: str, player: str):
        return join_session(game_id, player)

    def end(self, game_id: str, reward_per_player: float = 0.0, token: str = "ASM"):
        return end_session(game_id, reward_per_player, token)

    def sync_avatar(self, user_id: str, avatar_url: str):
        return sync_avatar(user_id, avatar_url)

    def mirror_event(self, user_id: str, event_type: str, data: dict):
        return record_avatar_event(user_id, event_type, data)

    def record_item(self, user_id: str, item_id: str, tx_hash: str):
        return add_item(user_id, item_id, tx_hash)

    def record_action(self, user_id: str, game_id: str, decision: str, action: str):
        return record_replay_action(user_id, game_id, decision, action)

    def finalize_replay(self, user_id: str, game_id: str):
        return finalize_replay(user_id, game_id)

    def overlay_ens(self, user_id: str, ens_name: str):
        result = overlay_identity(user_id, ens_name)
        if user_id.startswith("guest-"):
            merge_guest_progress(user_id, ens_name)
        return result

    def avatar(self, user_id: str):
        return get_avatar(user_id)

    def mirrored_profile(self, user_id: str):
        return get_mirrored_profile(user_id)

    def items(self, user_id: str):
        return list_items(user_id)

    def ens(self, user_id: str):
        return resolve_overlay(user_id)
