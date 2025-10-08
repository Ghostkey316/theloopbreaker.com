"""Command line interface for the Vaultfire protocol."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from dataclasses import asdict
from typing import Mapping, Sequence, Tuple

from persona_drift import PersonaDrift

from vaultfire.modules import MetaFade, Vaultfire22Core
from vaultfire.modules.beliefforge import BeliefForge
from vaultfire.modules.sanctumloop import SanctumLoop
from vaultfire.modules.ultrashadow import UltraShadow


GREEN = "\033[92m"
BLUE = "\033[94m"
YELLOW = "\033[93m"
RED = "\033[91m"
RESET = "\033[0m"
BOLD = "\033[1m"


def _color(text: str, colour: str) -> str:
    return f"{colour}{text}{RESET}"


def _heading(text: str, colour: str = BLUE) -> None:
    print(_color(f"{BOLD}{text}{RESET}", colour))


def _parse_entropy_range(value: str) -> Tuple[float, float]:
    separators = ("-", ":")
    for separator in separators:
        if separator in value:
            left, right = value.split(separator, 1)
            return float(left), float(right)
    numeric = float(value)
    return numeric, numeric


def _json_dump(payload: Mapping[str, object]) -> str:
    return json.dumps(payload, indent=2, sort_keys=True)


def _serialise_persona(profile) -> Mapping[str, object]:
    payload = asdict(profile)
    payload["timestamp"] = profile.timestamp.isoformat()
    return payload


def handle_deploy(profile: str) -> int:
    _heading(f"Deploying profile {profile}", GREEN)
    core = Vaultfire22Core(profile)
    payload = core.deploy()
    print(_color(_json_dump(payload), GREEN))
    return 0


def handle_fade(persona: str) -> int:
    _heading(f"MetaFade for persona {persona}", BLUE)
    fade = MetaFade(persona)
    digest = fade.dissolve()
    print(_color(f"Fade signature: {digest}", BLUE))
    return 0


def handle_drift(entropy_range: Tuple[float, float]) -> int:
    _heading("Simulating persona drift", GREEN)
    drift = PersonaDrift()
    low, high = entropy_range
    traits = {"entropy_range": [low, high], "mode": "simulation"}
    profile = drift.shift("vaultfire-cli", traits=traits)
    sanctum = SanctumLoop()
    shield = sanctum.shield_query(profile.wallet_origin, profile.override_route, profile.session_signature)
    payload = {
        "profile": _serialise_persona(profile),
        "sanctum": shield,
    }
    print(_color(_json_dump(payload), GREEN))
    return 0


def handle_test(all_tests: bool) -> int:
    if not all_tests:
        raise SystemExit("test command requires --all")
    _heading("Running pytest -q", YELLOW)
    if os.environ.get("PYTEST_CURRENT_TEST"):
        print(_color("Detected nested pytest session; reporting dry run.", YELLOW))
        return 0
    command = [sys.executable, "-m", "pytest", "-q"]
    process = subprocess.run(command, check=False)
    if process.returncode == 0:
        print(_color("All tests passed", GREEN))
    else:
        print(_color("Tests failed", RED))
    return process.returncode


def handle_cloak_status() -> int:
    _heading("Cloak status", BLUE)
    ultrashadow = UltraShadow()
    sanctum = SanctumLoop()
    belief = BeliefForge()
    belief_record = belief.forge_signal(confidence=0.7, doubt=0.2, trust=0.85, context="cloak-status")
    status_payload = {
        "ultrashadow": ultrashadow.status(),
        "sanctum": sanctum.status(),
        "belief_fingerprint": belief_record,
    }
    print(_color(_json_dump(status_payload), BLUE))
    return 0


def create_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="vaultfire", description="Vaultfire CLI tools")
    subparsers = parser.add_subparsers(dest="command", required=True)

    deploy = subparsers.add_parser("deploy", help="Deploy full pulse stack under chosen ghost persona")
    deploy.add_argument("--profile", required=True, help="Persona profile to deploy")

    fade = subparsers.add_parser("fade", help="Trigger MetaFade decay manually")
    fade.add_argument("--persona", required=True, help="Persona identifier")

    drift = subparsers.add_parser("drift", help="Preview future drift patterns")
    drift.add_argument("--simulate", required=True, type=_parse_entropy_range, help="Entropy range to simulate")

    test = subparsers.add_parser("test", help="Run test suites")
    test.add_argument("--all", action="store_true", help="Run all pytest suites")

    cloak = subparsers.add_parser("cloak", help="Show cloak status")
    cloak.add_argument("--status", action="store_true", help="Display current cloak modules")

    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = create_parser()
    args = parser.parse_args(argv)
    if args.command == "deploy":
        return handle_deploy(args.profile)
    if args.command == "fade":
        return handle_fade(args.persona)
    if args.command == "drift":
        return handle_drift(args.simulate)
    if args.command == "test":
        return handle_test(args.all)
    if args.command == "cloak":
        if not args.status:
            parser.error("cloak command requires --status")
        return handle_cloak_status()
    parser.error("Unknown command")


__all__ = [
    "create_parser",
    "handle_cloak_status",
    "handle_deploy",
    "handle_drift",
    "handle_fade",
    "handle_test",
    "main",
]

