from __future__ import annotations

from vaultfire.modules.vaultfire_protocol_stack import GiftMatrixV1, VaultfireProtocolStack


def test_gift_matrix_claim_tracks_forks_and_layers() -> None:
    matrix = GiftMatrixV1()
    interaction = "mission-1"
    matrix.record_signal(interaction, belief_purity=0.92, tags=("alpha",))
    matrix.register_fork(
        interaction,
        branch="monitor",
        priority="medium",
        ethic_score=0.81,
        alignment_bias=0.15,
    )
    record = matrix.claim(interaction, ["0xabc"])

    assert record.metadata["timeline_branch"] == "monitor"
    assert record.metadata["priority"] == "medium"

    layer = matrix.unlock_next_layer("Genesis unlock")
    assert layer["layer"] == 1

    status = matrix.pulse_watch()
    assert status["metadata"]["first_of_its_kind"] is True
    assert status["forks_tracked"] == 1


def test_protocol_stack_pulsewatch_includes_yield_summary() -> None:
    stack = VaultfireProtocolStack(actions=({"type": "support", "weight": 3},))
    summary = stack.pulsewatch()

    assert "belief_health" in summary
    assert summary["tempo"] == stack.time_engine.current_tempo()
