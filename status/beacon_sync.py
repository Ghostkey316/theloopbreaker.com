"""Continuously publish Ghostkey status beacons for the dashboard."""

from __future__ import annotations

import time
from typing import Any, Dict, Optional

try:  # pragma: no cover - optional dependency
    import requests
except ModuleNotFoundError:  # pragma: no cover - fallback when requests missing
    requests = None  # type: ignore

from vaultfire.beacon import log_status, update_beacon_light
from vaultfire.status import get_agent_status

AGENT_ID = "Ghostkey316"
BEACON_URL = "https://vaultfire.status/api/beacon"
POLL_INTERVAL_SECONDS = 10


def _post_status(status: str) -> Optional[Dict[str, Any]]:
    if not requests:
        return None
    try:
        response = requests.post(
            BEACON_URL,
            json={"agent": AGENT_ID, "status": status},
            timeout=5,
        )
        response.raise_for_status()
        return response.json() if response.headers.get("content-type", "").startswith("application/json") else None
    except Exception:
        return None


def beacon_sync_loop() -> None:
    print("🔄 Starting Beacon Sync Loop...")
    while True:
        try:
            status = get_agent_status(agent_id=AGENT_ID)

            if status == "active":
                update_beacon_light(AGENT_ID, "green")
                log_status(AGENT_ID, "🟢 Agent live and synced.")
            elif status == "pending":
                update_beacon_light(AGENT_ID, "yellow")
                log_status(AGENT_ID, "🟡 Agent deployed, awaiting confirmation.")
            elif status == "error":
                update_beacon_light(AGENT_ID, "red")
                log_status(AGENT_ID, "🔴 Error in deployment.")
            else:
                update_beacon_light(AGENT_ID, "gray")
                log_status(AGENT_ID, f"⚪ Unknown status: {status}")

            _post_status(status)
        except Exception as exc:
            print(f"⚠️ Beacon sync error: {exc}")

        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    beacon_sync_loop()
