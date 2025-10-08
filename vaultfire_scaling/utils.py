"""High level helpers for orchestrating the Vaultfire scaling codex."""

from __future__ import annotations

from dataclasses import dataclass
import logging
from typing import Iterable, Mapping, MutableSequence, Sequence


LOGGER = logging.getLogger("vaultfire.scaling")


@dataclass(frozen=True)
class GuiModule:
    """Metadata describing a module surfaced in the GUI layer."""

    name: str
    module_path: str
    doc: str | None


@dataclass(frozen=True)
class GuiLayerConfig:
    """Structured representation of the launched GUI layer."""

    theme: str
    lineage_trace: str
    modules: tuple[GuiModule, ...]


def _module_descriptor(module: object) -> GuiModule:
    klass = module if isinstance(module, type) else type(module)
    doc = klass.__doc__.strip() if isinstance(klass.__doc__, str) else None
    return GuiModule(name=klass.__name__, module_path=klass.__module__, doc=doc)


def launch_gui_layer(
    *,
    theme: str,
    lineage_trace: str,
    embedded_modules: Sequence[object],
) -> GuiLayerConfig:
    """Return a :class:`GuiLayerConfig` describing the GUI launch."""

    if not theme:
        raise ValueError("theme must be provided for the GUI layer")
    if not lineage_trace:
        raise ValueError("lineage_trace must be provided for the GUI layer")
    modules = tuple(_module_descriptor(module) for module in embedded_modules)
    LOGGER.info(
        "GUI layer launched",
        extra={
            "theme": theme,
            "lineage_trace": lineage_trace,
            "modules": [module.name for module in modules],
        },
    )
    return GuiLayerConfig(theme=theme, lineage_trace=lineage_trace, modules=modules)


@dataclass(frozen=True)
class ApiGatewayConfig:
    """Configuration payload for the public API gateway."""

    auth_required: bool
    endpoints: tuple[str, ...]
    attached_wallet: str


def open_api_gateway(
    *, auth_required: bool, endpoints: Sequence[str], attached_wallet: str
) -> ApiGatewayConfig:
    """Validate and return metadata for the public API gateway."""

    if not endpoints:
        raise ValueError("at least one endpoint must be provided")
    normalised = tuple(endpoint.strip() for endpoint in endpoints if endpoint.strip())
    if not normalised:
        raise ValueError("endpoints cannot be blank")
    if not attached_wallet:
        raise ValueError("attached_wallet must be provided")
    LOGGER.info(
        "API gateway opened",
        extra={"wallet": attached_wallet, "endpoints": normalised, "auth": auth_required},
    )
    return ApiGatewayConfig(
        auth_required=auth_required, endpoints=normalised, attached_wallet=attached_wallet
    )


@dataclass(frozen=True)
class BeliefNetSyncState:
    """Represents a recorded BeliefNet synchronisation."""

    moral_fingerprint: tuple[str, ...]
    fallback_to: str
    entropy_source: str


def sync_beliefnet(
    *, moral_fingerprint: Sequence[str], fallback_to: str, entropy_source: str
) -> BeliefNetSyncState:
    """Return metadata for the BeliefNet synchronisation step."""

    fingerprint = tuple(moral_fingerprint)
    if not fingerprint:
        raise ValueError("moral_fingerprint must contain at least one tag")
    if not fallback_to:
        raise ValueError("fallback_to must be provided")
    if not entropy_source:
        raise ValueError("entropy_source must be provided")
    LOGGER.info(
        "BeliefNet synchronised",
        extra={
            "fingerprint": fingerprint,
            "fallback": fallback_to,
            "entropy_source": entropy_source,
        },
    )
    return BeliefNetSyncState(
        moral_fingerprint=fingerprint, fallback_to=fallback_to, entropy_source=entropy_source
    )


@dataclass(frozen=True)
class PluginDeploymentResult:
    """Represents the deployment state for partner plug-ins."""

    deployed: tuple[str, ...]


def deploy_partner_plugins(plugins: Iterable[str]) -> PluginDeploymentResult:
    """Return a :class:`PluginDeploymentResult` for the provided plug-ins."""

    ordered: MutableSequence[str] = []
    for plugin in plugins:
        name = plugin.strip()
        if not name or name in ordered:
            continue
        ordered.append(name)
    LOGGER.info("Partner plug-ins deployed", extra={"plugins": ordered})
    return PluginDeploymentResult(deployed=tuple(ordered))


@dataclass(frozen=True)
class AgentRelayState:
    """Metadata describing the agent relay fork."""

    behavior_model: str
    relays: tuple[str, ...]
    sync_reference: Mapping[str, Mapping[str, object]]


def fork_agent_relay(
    *, behavior_model: str, relay_count: int, sync_pulse: Mapping[str, Mapping[str, object]]
) -> AgentRelayState:
    """Return a :class:`AgentRelayState` for the forked relays."""

    if relay_count <= 0:
        raise ValueError("relay_count must be positive")
    relays = tuple(f"relay-{index + 1}" for index in range(relay_count))
    LOGGER.info(
        "Agent relay forked",
        extra={"behavior_model": behavior_model, "relay_count": relay_count},
    )
    return AgentRelayState(
        behavior_model=behavior_model,
        relays=relays,
        sync_reference=dict(sync_pulse),
    )


@dataclass(frozen=True)
class VaultfireDAOState:
    """Represents the boot logic for the VaultfireDAO."""

    founding_address: str
    proposal_engine: str
    fallback_moral_filter: tuple[str, ...]


def init_vaultfire_dao(
    *,
    founding_address: str,
    proposal_engine: str,
    fallback_moral_filter: Sequence[str],
) -> VaultfireDAOState:
    """Return metadata indicating that the VaultfireDAO booted successfully."""

    if not founding_address:
        raise ValueError("founding_address must be provided")
    if not proposal_engine:
        raise ValueError("proposal_engine must be provided")
    fingerprint = tuple(fallback_moral_filter)
    if not fingerprint:
        raise ValueError("fallback_moral_filter must contain at least one entry")
    LOGGER.info(
        "VaultfireDAO initialised",
        extra={
            "founding_address": founding_address,
            "proposal_engine": proposal_engine,
            "fingerprint": fingerprint,
        },
    )
    return VaultfireDAOState(
        founding_address=founding_address,
        proposal_engine=proposal_engine,
        fallback_moral_filter=fingerprint,
    )


__all__ = [
    "AgentRelayState",
    "ApiGatewayConfig",
    "BeliefNetSyncState",
    "GuiLayerConfig",
    "GuiModule",
    "PluginDeploymentResult",
    "VaultfireDAOState",
    "deploy_partner_plugins",
    "fork_agent_relay",
    "init_vaultfire_dao",
    "launch_gui_layer",
    "open_api_gateway",
    "sync_beliefnet",
]
