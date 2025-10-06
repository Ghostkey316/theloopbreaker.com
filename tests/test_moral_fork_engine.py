from __future__ import annotations

import json

from vaultfire.protocol.moral_fork import MoralForkEngine
from vaultfire.protocol.timeflare import TimeFlare


def test_moral_fork_engine_branches_and_ledgers(tmp_path) -> None:
    ledger_path = tmp_path / "timeflare.json"
    timeflare = TimeFlare(ledger_path=ledger_path)
    engine = MoralForkEngine(timeflare=timeflare)

    # High composite score keeps the branch stable and avoids ledger writes.
    fork_stable = engine.evaluate(
        "session-stable",
        ethic_score=0.92,
        signal_weight=0.8,
        alignment_history=("aligned", "mission"),
    )
    assert fork_stable.branch == "stable"
    assert not ledger_path.exists()

    # Lower scores should produce a divergent fork and persist to ledger.
    fork_divergent = engine.evaluate(
        "session-risk",
        ethic_score=0.2,
        signal_weight=-0.5,
        alignment_history=("aligned", "breach", "drift"),
    )
    assert fork_divergent.branch == "divergent"
    assert ledger_path.exists()

    recorded = json.loads(ledger_path.read_text())
    assert recorded[-1]["interaction_id"] == "session-risk"
    assert recorded[-1]["branch"] == "divergent"
