from vaultfire.modules.ethic_resonant_time_engine import EthicResonantTimeEngine
from vaultfire.modules.living_memory_ledger import LivingMemoryLedger
from vaultfire.modules.soul_loop_fabric_engine import SoulLoopFabricEngine
from vaultfire.modules.temporal_dreamcatcher_engine import TemporalDreamcatcherEngine


def test_temporal_dreamcatcher_engine_listens_and_traces() -> None:
    time_engine = EthicResonantTimeEngine("tester")
    ledger = LivingMemoryLedger(identity_handle="bpow20.cb.id", identity_ens="ghostkey316.eth")
    fabric = SoulLoopFabricEngine(time_engine=time_engine, ledger=ledger)
    engine = TemporalDreamcatcherEngine(time_engine=time_engine, fabric=fabric)

    first = engine.capture_signal(0.75, channel="dream", intent="align")
    assert "Ghostkey-316 Certified" in first["metadata"]["tags"]

    summary = engine.listen(
        [
            {"signal": 0.62, "channel": "echo", "intent": "uplift"},
            {"signal": 0.58, "channel": "echo", "intent": "guard"},
        ],
        trust_floor=0.5,
    )
    assert summary["captured"] == 2
    assert summary["echo"]["metadata"]["first_of_its_kind"] is True

    echo = engine.echo(trust_floor=0.5)
    assert echo["metadata"]["tags"][0] == "First-of-its-Kind"
    assert len(echo["timeline"]) >= 1

    drift = engine.trace_drift(trust_floor=0.5, window=2)
    assert len(drift["captures"]) <= 2
    assert drift["metadata"]["identity"]["ens"] == "ghostkey316.eth"
