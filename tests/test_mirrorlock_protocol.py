"""Tests for the Mirrorlock privacy layer."""
from __future__ import annotations

from datetime import datetime

from mirrorbridge import MirrorBridge
from mirrorlock_core import MirrorlockCore
from timing_cloak import TimingCloak


def test_mirrorlock_generates_behavior_token() -> None:
    core = MirrorlockCore()
    token = core.observe(
        "ghostfire_shield",
        "dispatch",
        metadata={"payload": {"amount": 11, "currency": "VLT"}},
    )

    assert token.token_id.startswith("mlk_")
    assert token.override_route.startswith("ghostkey316://override/")
    assert token.shadow_route.startswith("shadowbridge://override/")
    assert len(token.mirrors) == 4
    assert all(event.token == token.token_id for event in token.mirrors)
    ledger = core.ledger_snapshot()
    assert len(ledger) == 1
    assert ledger[0].event_hash


def test_timing_cloak_obscures_signals() -> None:
    cloak = TimingCloak(seed=1337)
    base_time = datetime.utcnow()
    triggers = cloak.disperse(["alpha", "beta", "gamma"], base_timestamp=base_time)

    assert len(triggers) == 3
    assert triggers[0].scheduled_at >= base_time
    assert triggers[-1].scheduled_at >= triggers[0].scheduled_at
    assert all(trigger.delay_seconds > 0 for trigger in triggers)

    disguises = {cloak.obscure_packet_size(1024).cloaked_size for _ in range(5)}
    assert any(size != 1024 for size in disguises)

    frequency = cloak.modulate_frequency([1, 2, 3])
    assert abs(sum(frequency) - 1.0) < 1e-6


def test_mirrorbridge_identity_map_and_routes() -> None:
    bridge = MirrorBridge(base_identity="bpow20.cb.id")
    mapping = bridge.identity_map

    assert set(mapping.keys()) == {"ethereum", "base", "zora", "worldcoin"}

    events = bridge.mirror_token("mlk_test_token")
    assert len(events) == 4
    for event in events:
        assert event.route.startswith(f"mirrorbridge://{event.network}/")
        assert event.synthetic_identity.startswith("0x")

    route = bridge.resolve_network_route("ethereum")
    assert route.startswith("mirrorbridge://override/ethereum/")


def test_mirrorconsent_chain_and_presets() -> None:
    core = MirrorlockCore()
    core.consent_engine.set_preset("aggressive")

    core.observe("module.one", "ping", metadata={"count": 1})
    core.observe("module.one", "ping", metadata={"count": 2})

    ledger = core.ledger_snapshot()
    assert len(ledger) == 2
    assert ledger[0].event_hash != ledger[1].event_hash
    assert ledger[0].index == 1 and ledger[1].index == 2
