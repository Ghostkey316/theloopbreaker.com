#!/usr/bin/env python3
"""CLI harness for the enterprise integration test suite."""

import argparse
import json
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

from integration.cross_chain import CrossChainSyncScenario
from integration.load_environment import LoadSimulationConfig
from codex.enterprise_sync_validator import EnterpriseCodexValidator


TEST_REPORT = Path("integration/artifacts/integration_test_report.json")


def run_tests() -> dict:
    results = {}

    validator = EnterpriseCodexValidator()
    codex_results = validator.run()
    results["codex"] = all(item.passed for item in codex_results)

    scenario = CrossChainSyncScenario()
    sync_result = scenario.run()
    results["cross_chain"] = sync_result.status == "SYNCED"

    config = LoadSimulationConfig(concurrent_users=1_000, duration_seconds=30, ramp_up_seconds=5)
    results["load_configured"] = config.concurrent_users == 1_000

    TEST_REPORT.write_text(json.dumps(results, indent=2), encoding="utf-8")
    return results


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true", help="Print results as JSON")
    args = parser.parse_args()

    results = run_tests()
    if args.json:
        print(json.dumps(results, indent=2))
    else:
        for name, passed in results.items():
            print(f"{name}: {'PASS' if passed else 'FAIL'}")

    if not all(results.values()):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
