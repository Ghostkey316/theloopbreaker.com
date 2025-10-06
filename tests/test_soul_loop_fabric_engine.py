from vaultfire.modules.ethic_resonant_time_engine import EthicResonantTimeEngine
from vaultfire.modules.living_memory_ledger import LivingMemoryLedger
from vaultfire.modules.soul_loop_fabric_engine import SoulLoopFabricEngine


def test_soul_loop_trace_includes_trust_and_moral_score() -> None:
    time_engine = EthicResonantTimeEngine("tester")
    ledger = LivingMemoryLedger(identity_handle="bpow20.cb.id", identity_ens="ghostkey316.eth")
    fabric = SoulLoopFabricEngine(time_engine=time_engine, ledger=ledger)

    fabric.log_intent("align", confidence=0.9, tags=("ally",))
    fabric.log_intent("uplift", confidence=0.8, tags=("mission",))
    push_record = fabric.push_signal(0.7, intent="harmonize")

    assert push_record.trust >= 0.6

    trace = fabric.trace(window=2)
    assert trace["metadata"]["first_of_its_kind"] is True
    assert trace["tempo"] in {"slow", "normal", "fast", "ultrafast"}
    assert trace["moral_score"] == time_engine.mmi.get_score()
    assert trace["trust_window"] >= 0.6
    history = fabric.history()
    assert len(history) == 3
    assert history[-1]["payload"]["signal"] == 0.7
