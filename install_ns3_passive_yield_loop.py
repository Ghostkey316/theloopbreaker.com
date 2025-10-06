"""CLI helper to install the NS3 passive yield loop for Ghostkey deployments."""

from ns3.protocol import (
    activate_weekly_yield_distribution,
    apply_multiplier_for_ghostkey,
    install_passive_yield_engine,
    sync_behavior_to_loyalty_chain,
    validate_origin_rewards,
)

WALLET = "bpow20.cb.id"
ORIGIN = "Ghostkey316"


def install_yield_loop() -> None:
    """Run the coordinated passive yield loop installation sequence."""
    print("🌱 Installing Passive Yield Loop...")

    install_passive_yield_engine(wallet=WALLET)
    sync_behavior_to_loyalty_chain(wallet=WALLET, origin=ORIGIN)
    activate_weekly_yield_distribution(start_immediately=True)
    validate_origin_rewards(origin_id=ORIGIN)
    apply_multiplier_for_ghostkey(wallet=WALLET, level="Genesis++")

    print("✅ NS3 Yield Loop Active – Passive System Initialized")


if __name__ == "__main__":
    install_yield_loop()
