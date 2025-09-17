"""Final Vaultfire modules for partner onboarding and trust.

This package is intentionally defensive during import so that optional
dependencies (for example Flask or GPU bindings) do not break test
collection.  Individual submodules remain fully functional when their
requirements are available, while missing integrations expose lightweight
stubs that raise a descriptive error if invoked.
"""

from __future__ import annotations

from importlib import import_module
from typing import Any, Callable, Dict, Tuple


def _missing_dependency(feature: str) -> Callable[..., Any]:
    """Return a callable that raises a helpful error for optional modules."""

    def _raise(*_: Any, **__: Any) -> Any:
        raise RuntimeError(
            f"'{feature}' requires optional Vaultfire modules that are not "
            "available in this environment."
        )

    return _raise


_EXPORTS: Dict[str, Tuple[str, str, Callable[..., Any] | None]] = {
    "companion_app": (".companion_api", "app", None),
    "generate_brandkit": (".brandkit_portal", "generate_brandkit", _missing_dependency("generate_brandkit")),
    "register_partner_link": (".brandkit_portal", "register_partner_link", _missing_dependency("register_partner_link")),
    "audit_contracts": (".smart_contract_audit", "audit_contracts", _missing_dependency("audit_contracts")),
    "request_recovery": (".failsafe_recovery", "request_recovery", _missing_dependency("request_recovery")),
    "privacy_wipe": (".failsafe_recovery", "privacy_wipe", _missing_dependency("privacy_wipe")),
    "issue_badge": (".alignment_badge", "issue_badge", _missing_dependency("issue_badge")),
    "set_retail_revival_enabled": (".retail_revival_mode", "set_retail_revival_enabled", _missing_dependency("set_retail_revival_enabled")),
    "retail_revival_enabled": (".retail_revival_mode", "retail_revival_enabled", _missing_dependency("retail_revival_enabled")),
    "offline_prompt": (".retail_revival_mode", "offline_prompt", _missing_dependency("offline_prompt")),
    "nostalgia_overlay": (".retail_revival_mode", "nostalgia_overlay", _missing_dependency("nostalgia_overlay")),
    "retail_story_snippet": (".retail_revival_mode", "retail_story_snippet", _missing_dependency("retail_story_snippet")),
    "record_visit": (".retail_revival_mode", "record_visit", _missing_dependency("record_visit")),
    "visit_history": (".retail_revival_mode", "visit_history", _missing_dependency("visit_history")),
    "generate_image": (".vaultfire_media", "generate_image", _missing_dependency("generate_image")),
    "transcribe_audio": (".vaultfire_media", "transcribe_audio", _missing_dependency("transcribe_audio")),
    "voice_response": (".vaultfire_media", "voice_response", _missing_dependency("voice_response")),
    "analyze_video": (".vaultfire_media", "analyze_video", _missing_dependency("analyze_video")),
    "build_avatar": (".vaultfire_media", "build_avatar", _missing_dependency("build_avatar")),
    "log_system_snapshot": (".grid_gpu_monitor", "log_system_snapshot", _missing_dependency("log_system_snapshot")),
    "summarize_state": (".grid_gpu_monitor", "summarize_state", _missing_dependency("summarize_state")),
    "ghostkey_shield": (".behavior_drift_defense", "ghostkey_shield", _missing_dependency("ghostkey_shield")),
    "simulate_behavior_drift": (".behavior_drift_defense", "simulate_behavior_drift", _missing_dependency("simulate_behavior_drift")),
    "model_misuse": (".multi_domain_risk_mirror", "model_misuse", _missing_dependency("model_misuse")),
    "sanitize_terms": (".multi_domain_risk_mirror", "sanitize_terms", _missing_dependency("sanitize_terms")),
}


def __getattr__(name: str) -> Any:
    if name not in _EXPORTS:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

    module_name, attr_name, fallback = _EXPORTS[name]
    try:
        module = import_module(module_name, __name__)
        value = getattr(module, attr_name)
    except Exception:
        value = None if fallback is None else fallback
    globals()[name] = value
    return value


__all__ = sorted(_EXPORTS.keys())
