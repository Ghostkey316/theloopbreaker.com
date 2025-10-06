"""Pilot mode namespace for secure partner testing."""

import importlib

from .access_layer import PilotAccessLayer
from .feedback import FeedbackCollector, FeedbackRecord
from .ghostkey_agent import (
    AgentConfig,
    AgentLaunchState,
    AgentWidget,
    AgentWorkflow,
    GhostkeyVaultfireAgent,
    MissionControlPoints,
)
from .keys import ProtocolKey, ProtocolKeyManager
from .privacy import PilotPrivacyLedger, PilotReference
from .registry import PilotAccessRegistry, PartnerRecord
from .resonance import PilotResonanceTelemetry
from .sandbox import SandboxResult, YieldSandbox
from .session import PilotSession, SessionFactory

__all__ = [
    "PilotAccessLayer",
    "FeedbackCollector",
    "FeedbackRecord",
    "AgentConfig",
    "AgentLaunchState",
    "AgentWidget",
    "AgentWorkflow",
    "GhostkeyVaultfireAgent",
    "MissionControlPoints",
    "ProtocolKey",
    "ProtocolKeyManager",
    "PilotAccessRegistry",
    "PartnerRecord",
    "PilotPrivacyLedger",
    "PilotReference",
    "PilotResonanceTelemetry",
    "SandboxResult",
    "YieldSandbox",
    "PilotSession",
    "SessionFactory",
    "MissionControlHookBundle",
    "mission_control_setup",
    "mission_control_hooks",
    "stealth_telemetry",
]

_LAZY_ATTRS = {
    "mission_control_hooks": ".mission_control_hooks",
    "stealth_telemetry": ".stealth_telemetry",
}


def __getattr__(name):
    if name == "MissionControlHookBundle" or name == "mission_control_setup":
        module = importlib.import_module(".mission_control_hooks", __name__)
        value = getattr(module, "MissionControlHookBundle" if name == "MissionControlHookBundle" else "setup")
        globals()[name] = value
        return value
    if name in _LAZY_ATTRS:
        module = importlib.import_module(_LAZY_ATTRS[name], __name__)
        globals()[name] = module
        return module
    raise AttributeError(name)

