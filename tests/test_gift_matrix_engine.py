import pytest

from vaultfire.modules.ethic_resonant_time_engine import EthicResonantTimeEngine
from vaultfire.modules.gift_matrix_engine import GiftMatrixEngine
from vaultfire.modules.living_memory_ledger import LivingMemoryLedger


def test_gift_matrix_requires_impact_above_ego() -> None:
    time_engine = EthicResonantTimeEngine("tester")
    ledger = LivingMemoryLedger(identity_handle="bpow20.cb.id", identity_ens="ghostkey316.eth")
    engine = GiftMatrixEngine(time_engine=time_engine, ledger=ledger)

    assert engine.eligible(impact=1.0, ego=0.25) is True

    with pytest.raises(ValueError):
        engine.prepare_claim(
            "claim-block",
            impact=0.3,
            ego=0.5,
            recipients=["0xabc"],
        )

    result = engine.prepare_claim(
        "claim-ready",
        impact=1.2,
        ego=0.4,
        recipients=["0xabc", {"wallet": "0xdef", "belief_multiplier": 1.5}],
    )

    assert result["metadata"]["first_of_its_kind"] is True
    assert len(result["allocations"]) == 2
    assert sum(item["allocation"] for item in result["allocations"]) > 0

    claim = engine.claim("claim-ready")
    assert claim is not None
    assert claim["record"]["impact"] == pytest.approx(1.2)
