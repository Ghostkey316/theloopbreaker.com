#!/usr/bin/env python3
"""Execute the cross-chain sync simulation."""

from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

from integration.cross_chain import CrossChainSyncScenario


def main() -> None:
    scenario = CrossChainSyncScenario()
    result = scenario.run()
    print("Cross-chain sync status:", result.status)
    print("Composite hash:", result.composite_hash)


if __name__ == "__main__":
    main()
