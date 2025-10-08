from __future__ import annotations

import pytest

from vaultfire.modules import CloakPulse, MetaFade, BeliefForge, PulseMirror, UltraShadow
from vaultfire_scaling import (
    AgentRelayState,
    ApiGatewayConfig,
    BeliefNetSyncState,
    GuiLayerConfig,
    PluginDeploymentResult,
    VaultfireDAOState,
    deploy_partner_plugins,
    fork_agent_relay,
    init_vaultfire_dao,
    launch_gui_layer,
    open_api_gateway,
    sync_beliefnet,
)


def test_launch_gui_layer_includes_module_metadata() -> None:
    config = launch_gui_layer(
        theme="BeliefGlow",
        lineage_trace="ghostkey316.eth",
        embedded_modules=[UltraShadow(), BeliefForge(), MetaFade("trace")],
    )
    assert isinstance(config, GuiLayerConfig)
    names = {module.name for module in config.modules}
    assert names == {"UltraShadow", "BeliefForge", "MetaFade"}


def test_open_api_gateway_normalises_endpoints() -> None:
    config = open_api_gateway(
        auth_required=True,
        endpoints=[" /deploy ", "/cloak"],
        attached_wallet="bpow20.cb.id",
    )
    assert isinstance(config, ApiGatewayConfig)
    assert config.endpoints == ("/deploy", "/cloak")


@pytest.mark.parametrize("endpoints", [[], ["   "]])
def test_open_api_gateway_requires_endpoints(endpoints: list[str]) -> None:
    with pytest.raises(ValueError):
        open_api_gateway(auth_required=True, endpoints=endpoints, attached_wallet="wallet")


def test_sync_beliefnet_persists_fingerprint() -> None:
    belief = BeliefForge()
    record = belief.forge_signal(confidence=0.5, doubt=0.2, trust=0.7, context="test")
    sync_state = sync_beliefnet(
        moral_fingerprint=record["moral_fingerprint"],
        fallback_to="SanctumLoop",
        entropy_source="EntropySeedNetwork",
    )
    assert isinstance(sync_state, BeliefNetSyncState)
    assert tuple(record["moral_fingerprint"]) == sync_state.moral_fingerprint


def test_deploy_partner_plugins_deduplicates() -> None:
    plugins = deploy_partner_plugins(["NS3", "NS3", "OpenAI"])
    assert isinstance(plugins, PluginDeploymentResult)
    assert plugins.deployed == ("NS3", "OpenAI")


def test_fork_agent_relay_creates_expected_count() -> None:
    pulse = CloakPulse(lineage="test").emit(context="relay")
    sync_pulse = PulseMirror(pulse).sync()
    state = fork_agent_relay(
        behavior_model="ghost",
        relay_count=3,
        sync_pulse=sync_pulse,
    )
    assert isinstance(state, AgentRelayState)
    assert state.relays == ("relay-1", "relay-2", "relay-3")


@pytest.mark.parametrize("relay_count", [0, -1])
def test_fork_agent_relay_requires_positive_count(relay_count: int) -> None:
    pulse = CloakPulse(lineage="test").emit(context="relay")
    sync_pulse = PulseMirror(pulse).sync()
    with pytest.raises(ValueError):
        fork_agent_relay(
            behavior_model="ghost",
            relay_count=relay_count,
            sync_pulse=sync_pulse,
        )


def test_init_vaultfire_dao_requires_fingerprint() -> None:
    with pytest.raises(ValueError):
        init_vaultfire_dao(
            founding_address="bpow20.cb.id",
            proposal_engine="SignalDriven",
            fallback_moral_filter=[],
        )


def test_init_vaultfire_dao_returns_state() -> None:
    state = init_vaultfire_dao(
        founding_address="bpow20.cb.id",
        proposal_engine="SignalDriven",
        fallback_moral_filter=["guardian"],
    )
    assert isinstance(state, VaultfireDAOState)
    assert state.fallback_moral_filter == ("guardian",)
