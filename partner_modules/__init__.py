"""Partner onboarding modules with optional plugin support."""

from importlib import import_module
from pathlib import Path

from .verifiability_console import (
    record_audit_log,
    get_audit_logs,
    log_bug_check,
    uptime_status,
    record_test_result,
    export_dashboard_csv,
    badge_certificate,
)
from .revenue_engine import (
    set_config as set_revenue_config,
    calc_share as calculate_partner_share,
    payout as payout_revenue,
    apply_loyalty_bonus,
)
from .sandbox_launcher import (
    launch_sandbox,
    record_event as record_sandbox_event,
    cleanup_expired as cleanup_sandboxes,
)
from .devkit import generate_openapi, sdk_stub_paths
from .themeforge import set_theme, preview_theme
from .legal_compliance import (
    view_contract,
    generate_terms,
    generate_privacy_policy,
    set_region,
    region_mode,
    content_allowed,
)
from .multi_identity import (
    link_wallet,
    assign_handle,
    add_tag,
    identity_cluster,
    cluster_analytics,
)
from .dynamic_kpi import record_event as record_kpi_event, generate_dashboard
from .partner_demo import (
    start_demo,
    simulate_activity,
    walkthrough_steps,
    cleanup_expired as cleanup_demos,
)
from .addon_config import set_addon_enabled, addon_enabled

__all__ = [
    "record_audit_log",
    "get_audit_logs",
    "log_bug_check",
    "uptime_status",
    "record_test_result",
    "export_dashboard_csv",
    "badge_certificate",
    "set_revenue_config",
    "calculate_partner_share",
    "payout_revenue",
    "apply_loyalty_bonus",
    "launch_sandbox",
    "record_sandbox_event",
    "cleanup_sandboxes",
    "generate_openapi",
    "sdk_stub_paths",
    "set_theme",
    "preview_theme",
    "view_contract",
    "generate_terms",
    "generate_privacy_policy",
    "set_region",
    "region_mode",
    "content_allowed",
    "link_wallet",
    "assign_handle",
    "add_tag",
    "identity_cluster",
    "cluster_analytics",
    "record_kpi_event",
    "generate_dashboard",
    "start_demo",
    "simulate_activity",
    "walkthrough_steps",
    "cleanup_demos",
    "set_addon_enabled",
    "addon_enabled",
]

# -----------------------------------------------------
# Optional partner plugins
# -----------------------------------------------------
PLUGIN_DIR = Path(__file__).resolve().parents[1] / "partner_plugins"
if PLUGIN_DIR.exists():
    for path in PLUGIN_DIR.glob("*.py"):
        if path.stem == "__init__":
            continue
        try:
            mod = import_module(f"partner_plugins.{path.stem}")
            for name in getattr(mod, "__all__", []):
                globals()[name] = getattr(mod, name)
                __all__.append(name)
        except Exception:
            continue
