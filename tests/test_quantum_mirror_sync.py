from __future__ import annotations

from vaultfire.quantum.hashmirror import QuantumHashMirror


def test_quantum_hashmirror_generates_unique_tags() -> None:
    mirror = QuantumHashMirror(seed="unit-test")
    tag_one = mirror.imprint(
        "0xabc",
        interaction_id="interaction-1",
        branch="monitor",
        payload={"allocation": 120.5},
    )
    tag_two = mirror.imprint(
        "0xabc",
        interaction_id="interaction-1",
        branch="monitor",
        payload={"allocation": 120.5},
    )

    assert tag_one != tag_two
    assert mirror.verify(tag_one, "0xabc")
    snapshot = mirror.snapshot()
    assert tag_one in snapshot
    assert snapshot[tag_one]["context"]["interaction_id"] == "interaction-1"
