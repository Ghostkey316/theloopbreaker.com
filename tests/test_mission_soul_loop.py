from __future__ import annotations

from vaultfire.modules.vaultfire_protocol_stack import MissionSoulLoop


def test_mission_soul_loop_logs_history_and_checkpoints() -> None:
    loop = MissionSoulLoop()
    entry = loop.log_intent("Expand Vaultfire outreach", confidence=0.91, tags=("mission",))

    assert entry["intent"] == "Expand Vaultfire outreach"
    assert entry["confidence"] == 0.91

    profile = loop.update_profile(role="guardian", resonance="high")
    assert profile["role"] == "guardian"

    history = loop.history()
    assert history[-1]["tags"] == ("mission",)

    checkpoint = loop.checkpoint()
    assert checkpoint["profile"]["soul_checkpoint"] == 1
    assert checkpoint["profile"]["ens"] == "ghostkey316.eth"
