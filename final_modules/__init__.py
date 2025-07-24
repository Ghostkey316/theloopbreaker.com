"""Final Vaultfire modules for partner onboarding and trust."""

from .companion_api import app as companion_app
from .brandkit_portal import generate_brandkit, register_partner_link
from .smart_contract_audit import audit_contracts
from .failsafe_recovery import request_recovery, privacy_wipe
from .alignment_badge import issue_badge

__all__ = [
    "companion_app",
    "generate_brandkit",
    "register_partner_link",
    "audit_contracts",
    "request_recovery",
    "privacy_wipe",
    "issue_badge",
]
