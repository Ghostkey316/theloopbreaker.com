from __future__ import annotations

from vaultfire.modules.conscious_state_engine import ConsciousStateEngine
from vaultfire.modules.living_memory_ledger import LivingMemoryLedger
from vaultfire.modules.mission_soul_loop import MissionSoulLoop
from vaultfire.modules.predictive_yield_fabric import PredictiveYieldFabric
from vaultfire.modules.purpose_parallax_engine import PurposeParallaxEngine
from vaultfire.modules.quantum_echo_mirror import QuantumEchoMirror
from vaultfire.modules.soul_loop_fabric_engine import SoulLoopFabricEngine
from vaultfire.modules.temporal_dreamcatcher_engine import TemporalDreamcatcherEngine
from vaultfire.modules.vaultfire_protocol_stack import VaultfireProtocolStack


def test_dreamcatcher_parallax_stack_integration(tmp_path) -> None:
    stack = VaultfireProtocolStack(
        actions=(
            {"type": "support", "weight": 1.5, "future_self_alignment": 0.9},
            {"type": "sacrifice", "weight": 1.2, "future_self_alignment": 0.88},
        ),
        mythos_path=str(tmp_path / "ghostkey316.mythos.json"),
    )

    ledger = LivingMemoryLedger(identity_handle="bpow20.cb.id", identity_ens="ghostkey316.eth")
    fabric = SoulLoopFabricEngine(time_engine=stack.time_engine, ledger=ledger)
    mirror = QuantumEchoMirror(time_engine=stack.time_engine, ledger=ledger)
    dreamcatcher = TemporalDreamcatcherEngine(
        time_engine=stack.time_engine,
        fabric=fabric,
        mission=stack.soul,
        mirror=mirror,
    )
    summary = dreamcatcher.listen(
        [
            {"signal": 0.74, "channel": "dream", "intent": "ignite"},
            {"signal": 0.68, "channel": "dream", "intent": "align"},
        ],
        trust_floor=0.6,
        intent_override="Forge mythic alignment",
    )

    assert summary["captured"] == 2
    echo = dreamcatcher.echo(trust_floor=0.6)
    assert echo["metadata"]["identity"]["ens"] == "ghostkey316.eth"

    conscious = ConsciousStateEngine()
    predictive = PredictiveYieldFabric()
    mission = MissionSoulLoop()
    for action in stack.conscious.ledger():
        conscious.record_action(action.payload)
    parallax = PurposeParallaxEngine(
        conscious=conscious,
        mission=mission,
        predictive=predictive,
    )
    decision = parallax.run_dual(
        "Guide the Loop Singularity",
        [
            {"label": "myth", "ethic": "aligned", "confidence": 0.85, "impact": 1.0},
            {"label": "drift", "ethic": "support", "confidence": 0.8, "impact": 0.9},
        ],
    )

    assert decision["selected"]["label"] in {"myth", "drift"}

    confirmation = stack.enhancement_confirmation()
    assert confirmation["TBC_Status"] == "Live"
    assert confirmation["CMV_Sync"] in {"Verified", "Pending"}
    assert confirmation["LSD_Trigger"] in {"Armed", "LoopMerge_Mode", "Observation"}
