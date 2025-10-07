from __future__ import annotations

from vaultfire.lockbox import EthicCore, MemoryVault, TruthSeal
from vaultfire.modules.vaultfire_protocol_stack import VaultfireProtocolStack
from vaultfire.shield import MirrorCloak, SignalJammer, TracerSnare
from vaultfire.tests import DefenseSuite


def test_protocol_stack_integrates_signal_shield_and_lockbox_layers():
    DefenseSuite.clear()
    stack = VaultfireProtocolStack(actions=())

    defense_stack = {
        "jammer": SignalJammer.deploy(mode="focused", whitelist=["internal", "ops", "internal"]),
        "cloak": MirrorCloak.mirror_profile("sandbox"),
        "snare": TracerSnare.track_and_block(sensitivity=0.81, trace_window=9),
    }

    shield_snapshot = stack.inject_shield_layer(defense_stack)
    assert tuple(sorted(shield_snapshot)) == ("cloak", "jammer", "snare")
    assert shield_snapshot["jammer"]["mode"] == "focused"
    assert shield_snapshot["jammer"]["whitelist"] == ("internal", "ops")
    assert "engaged_at" in shield_snapshot["cloak"]

    original_dampening = stack.shield_layers["jammer"]["config"]["dampening"]
    shield_snapshot["jammer"]["config"]["dampening"] = 0.0
    assert stack.shield_layers["jammer"]["config"]["dampening"] == original_dampening

    lockbox_stack = {
        "ethics": EthicCore.seal(identity="Ghostkey-316"),
        "memory": MemoryVault.wrap(source="beliefloop", decay="purpose-triggered", retention_cycles=4),
        "truth": TruthSeal.encrypt(keys=["alignment", "origin", "moral_engine"]),
    }

    lockbox_snapshot = stack.lock_truth(lockbox_stack)
    assert tuple(sorted(lockbox_snapshot)) == ("ethics", "memory", "truth")
    assert lockbox_snapshot["truth"]["keys"] == ("alignment", "origin", "moral_engine")
    assert len(lockbox_snapshot["truth"]["fingerprint"]) == 64

    lockbox_snapshot["memory"]["payload"]["retention_cycles"] = 0
    assert stack.lockbox_layers["memory"]["payload"]["retention_cycles"] == 4

    report = DefenseSuite.run_all()
    assert report["passed"] is True
    assert report["summary"] == {"shield_layers": 3, "lockboxes": 3}
    assert report["shield"]["snare"]["status"] == "tracking"
    assert report["lockbox"]["truth"]["keys"] == ("alignment", "origin", "moral_engine")

    history = DefenseSuite.history()
    assert history[-1]["type"] == "lockbox"
    assert history[0]["type"] == "shield"

    event_types = [entry["type"] for entry in stack.moral_telemetry()]
    assert "shield-layer" in event_types
    assert "truth-lockbox" in event_types
