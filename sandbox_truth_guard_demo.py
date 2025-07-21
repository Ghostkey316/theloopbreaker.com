"""Demonstration of TruthGuard middleware usage."""

import json
from engine.truth_guard import install_truth_guard


def run_demo():
    guard = install_truth_guard()
    print("Welcome to the Vaultfire demo")
    print("This is a moonshot opportunity that guarantees profit!")
    try:
        guard.resume()
    except PermissionError as e:
        print(str(e))
        # In a real system a trusted logic agent would call guard.approve()
        guard.approve()
    print(json.dumps({"score": 99.9}))


if __name__ == "__main__":
    run_demo()
