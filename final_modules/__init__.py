"""Final Vaultfire modules for partner onboarding and trust."""

from .companion_api import app as companion_app
from .brandkit_portal import generate_brandkit, register_partner_link
from .smart_contract_audit import audit_contracts
from .failsafe_recovery import request_recovery, privacy_wipe
from .alignment_badge import issue_badge
from .retail_revival_mode import (
    set_retail_revival_enabled,
    retail_revival_enabled,
    offline_prompt,
    nostalgia_overlay,
    retail_story_snippet,
    record_visit,
    visit_history,
)
from .vaultfire_media import (
    generate_image,
    transcribe_audio,
    voice_response,
    analyze_video,
    build_avatar,
)

__all__ = [
    "companion_app",
    "generate_brandkit",
    "register_partner_link",
    "audit_contracts",
    "request_recovery",
    "privacy_wipe",
    "issue_badge",
    "set_retail_revival_enabled",
    "retail_revival_enabled",
    "offline_prompt",
    "nostalgia_overlay",
    "retail_story_snippet",
    "record_visit",
    "visit_history",
    "generate_image",
    "transcribe_audio",
    "voice_response",
    "analyze_video",
    "build_avatar",
]
