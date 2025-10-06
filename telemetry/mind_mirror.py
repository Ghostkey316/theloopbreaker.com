"""Runtime loop for the Vaultfire Telemetry Mind Mirror."""

from __future__ import annotations

import time

from vaultfire.telemetry import (
    extract_loyalty_triggers,
    mirror_adaptive_learning,
    push_mirror_to_dashboard,
    stream_belief_logs,
    sync_behavior_data,
)

AGENT_ID = "Ghostkey316"
SYNC_INTERVAL = 15  # seconds


def run_telemetry_mind_mirror(
    agent_id: str = AGENT_ID,
    *,
    sync_interval: int = SYNC_INTERVAL,
) -> None:
    """Continuously sync the Mind Mirror dashboard for ``agent_id``."""

    if sync_interval <= 0:
        raise ValueError("sync_interval must be greater than zero")

    print("🪞 Launching Telemetry Mind Mirror...")

    try:
        while True:
            belief_logs = stream_belief_logs(agent_id=agent_id)
            behavior_data = sync_behavior_data(agent_id=agent_id, belief_logs=belief_logs)
            loyalty_insights = extract_loyalty_triggers(behavior_data)
            updated_model = mirror_adaptive_learning(agent_id, behavior_data, belief_logs)

            push_mirror_to_dashboard(agent_id, updated_model, loyalty_insights)

            print(f"✅ Synced beliefs, loyalty, and learnings for {agent_id}")
            time.sleep(sync_interval)
    except KeyboardInterrupt:
        print("🛑 Telemetry Mind Mirror halted by operator.")


__all__ = ["run_telemetry_mind_mirror"]


if __name__ == "__main__":
    run_telemetry_mind_mirror()
