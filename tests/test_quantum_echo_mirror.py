from datetime import datetime, timedelta, timezone

from vaultfire.modules.ethic_resonant_time_engine import EthicResonantTimeEngine
from vaultfire.modules.living_memory_ledger import LivingMemoryLedger
from vaultfire.modules.quantum_echo_mirror import QuantumEchoMirror
from vaultfire.modules.soul_loop_fabric_engine import SoulLoopFabricEngine


def test_quantum_echo_respects_temporal_bounds_and_trust() -> None:
    time_engine = EthicResonantTimeEngine("tester")
    ledger = LivingMemoryLedger(identity_handle="bpow20.cb.id", identity_ens="ghostkey316.eth")
    fabric = SoulLoopFabricEngine(time_engine=time_engine, ledger=ledger)

    old_timestamp = datetime.now(timezone.utc) - timedelta(hours=10)
    ledger.record({"intent": "archive", "confidence": 0.9}, timestamp=old_timestamp, trust=0.9)
    fabric.log_intent("align", confidence=0.9)
    recent = fabric.log_intent("uplift", confidence=0.85)
    mirror = QuantumEchoMirror(time_engine=time_engine, ledger=ledger)

    projection = mirror.project_future(steps=3, trust_floor=0.7)
    assert projection["metadata"]["first_of_its_kind"] is True
    assert projection["forecast"], "expected at least one forecast entry"
    record_ids = [entry["record_id"] for entry in projection["forecast"]]
    assert recent.record_id in record_ids
    assert "memory-0001" not in record_ids

    timeline = mirror.traceback(trust_floor=0.5)
    assert len(timeline["timeline"]) == 2
    assert timeline["timeline"][-1]["record_id"] == recent.record_id
