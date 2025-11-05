"""Locust load-test script for Vaultfire yield distributor."""
from __future__ import annotations

try:
    from locust import User, between, task  # type: ignore
except Exception:  # pragma: no cover - locust is optional for tests
    User = object  # type: ignore
    between = lambda *_, **__: 1  # type: ignore

    def task(func):  # type: ignore
        return func

from vaultfire_yield_distributor import trigger_yield_drop


class YieldDistributorUser(User):
    wait_time = between(0.01, 0.1)

    @task
    def claim_yield(self) -> None:
        result = trigger_yield_drop(
            "pilot.eth", "0xPilot", "belief_sync", token="ASM", dry_run=True
        )
        if result.get("status") == "blocked":
            raise RuntimeError(f"Drift guard triggered: {result.get('reason')}")


class ChainlinkOracleUser(YieldDistributorUser):
    wait_time = between(0.05, 0.2)

    @task
    def refresh(self) -> None:
        trigger_yield_drop("oracle.eth", "0xOracle", "partner_activation", dry_run=True)
