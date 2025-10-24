"""Command line interface for the Vaultfire protocol."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
from dataclasses import asdict
from pathlib import Path
from typing import Mapping, Sequence, Tuple

from persona_drift import PersonaDrift

from vaultfire.modules import (
    FULL_STACK_MODE,
    LITE_MODE,
    MetaFade,
    Vaultfire22Core,
    get_modules_for_mode,
)
from vaultfire.modules.beliefforge import BeliefForge
from vaultfire.modules.sanctumloop import SanctumLoop
from vaultfire.modules.ultrashadow import UltraShadow
from vaultfire.security import crypto_disclaimer, submit_post_quantum_verifier
from vaultfire.recovery import RecoveryError, load_last_snapshot, resync_codex_memory


GREEN = "\033[92m"
BLUE = "\033[94m"
YELLOW = "\033[93m"
RED = "\033[91m"
RESET = "\033[0m"
BOLD = "\033[1m"

_REPO_ROOT = Path(__file__).resolve().parent.parent
_AUDIT_TRAIL_PATH = _REPO_ROOT / "vaultfire" / "audit-trail.md"
_AUDIT_LOG_MARKER = "<!-- LOG-ENTRIES -->"


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


def _render_modules_for_mode(mode: str) -> Mapping[str, object]:
    modules = [module.as_dict() for module in get_modules_for_mode(mode)]
    return {
        "mode": mode,
        "modules": modules,
        "status": "pending_audit",
        "disclaimer": crypto_disclaimer(),
    }


def _append_audit_log(row: str) -> None:
    if not _AUDIT_TRAIL_PATH.exists():
        raise FileNotFoundError(f"Audit trail file missing at {_AUDIT_TRAIL_PATH}")
    contents = _AUDIT_TRAIL_PATH.read_text(encoding="utf-8")
    if _AUDIT_LOG_MARKER not in contents:
        raise RuntimeError("Audit trail marker not found")
    updated = contents.replace(_AUDIT_LOG_MARKER, f"{row}\n{_AUDIT_LOG_MARKER}", 1)
    _AUDIT_TRAIL_PATH.write_text(updated, encoding="utf-8")


def handle_deploy(profile: str, *, pilot: bool = False) -> int:
    _heading(f"Deploying profile {profile}", GREEN)
    if pilot:
        payload = {
            "profile": profile,
            "sandbox": True,
            "onboarding": _render_modules_for_mode(LITE_MODE),
        }
    else:
        core = Vaultfire22Core(profile)
        payload = core.deploy()
    print(_color(_json_dump(payload), GREEN))
    return 0


def handle_fade(persona: str, *, pilot: bool = False) -> int:
    _heading(f"MetaFade for persona {persona}", BLUE)
    if pilot:
        digest = hashlib.sha256(f"pilot::{persona}".encode("utf-8")).hexdigest()[:32]
        print(
            _color(
                f"Pilot fade signature: {digest} (synthetic, {crypto_disclaimer()})",
                BLUE,
            )
        )
    else:
        fade = MetaFade(persona)
        digest = fade.dissolve()
        print(_color(f"Fade signature: {digest}", BLUE))
    return 0


def handle_drift(entropy_range: Tuple[float, float], *, pilot: bool = False) -> int:
    _heading("Simulating persona drift", GREEN)
    low, high = entropy_range
    if pilot:
        payload = {
            "mode": "pilot",
            "entropy_range": [low, high],
            "synthetic_modules": _render_modules_for_mode(LITE_MODE),
            "disclaimer": crypto_disclaimer(),
        }
    else:
        drift = PersonaDrift()
        traits = {"entropy_range": [low, high], "mode": "simulation"}
        profile = drift.shift("vaultfire-cli", traits=traits)
        sanctum = SanctumLoop()
        shield = sanctum.shield_query(
            profile.wallet_origin, profile.override_route, profile.session_signature
        )
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


def handle_cloak_status(*, pilot: bool = False) -> int:
    _heading("Cloak status", BLUE)
    if pilot:
        status_payload = {
            "sandbox": True,
            "onboarding": _render_modules_for_mode(LITE_MODE),
            "disclaimer": crypto_disclaimer(),
        }
    else:
        ultrashadow = UltraShadow()
        sanctum = SanctumLoop()
        belief = BeliefForge()
        belief_record = belief.forge_signal(
            confidence=0.7, doubt=0.2, trust=0.85, context="cloak-status"
        )
        status_payload = {
            "ultrashadow": ultrashadow.status(),
            "sanctum": sanctum.status(),
            "belief_fingerprint": belief_record,
        }
    print(_color(_json_dump(status_payload), BLUE))
    return 0


def handle_verify(*, crypto: bool, target: str, pilot: bool = False) -> int:
    if not crypto:
        raise SystemExit("verify command currently requires --crypto")
    _heading("Submitting crypto attestation", GREEN)
    mode = LITE_MODE if pilot else FULL_STACK_MODE
    payload = {
        "target": target,
        "pilot_mode": bool(pilot),
        "modules": _render_modules_for_mode(mode),
    }
    attestation = submit_post_quantum_verifier(target, payload=payload)
    row = (
        f"| {attestation.timestamp} | {attestation.target} | {attestation.dao_request_id} | "
        f"`{attestation.digest}` | {attestation.status} | {('pilot ' if pilot else '')}pending audit |"
    )
    _append_audit_log(row)
    output = attestation.export()
    output["audit_log_path"] = str(_AUDIT_TRAIL_PATH)
    print(_color(_json_dump(output), GREEN))
    return 0


def handle_recover(*, pilot: bool = False) -> int:
    del pilot  # signature retains pilot flag for symmetry with other handlers
    _heading("Vaultfire disaster recovery", YELLOW)
    try:
        snapshot = load_last_snapshot()
    except FileNotFoundError as exc:
        print(_color(str(exc), RED))
        return 1
    except RecoveryError as exc:
        print(_color(f"Recovery snapshot invalid: {exc}", RED))
        return 1
    try:
        payload = resync_codex_memory(snapshot)
    except RecoveryError as exc:
        print(_color(f"Recovery failed: {exc}", RED))
        return 1
    print(_color(_json_dump(payload), GREEN))
    return 0


def create_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="vaultfire", description="Vaultfire CLI tools")
    parser.add_argument(
        "--pilot",
        action="store_true",
        help="Enable sandbox pilot mode with synthetic data outputs",
    )
    parser.add_argument(
        "--recover",
        action="store_true",
        help="Restore codex memory, ledger state, and companion config from the latest snapshot",
    )
    subparsers = parser.add_subparsers(dest="command", required=False)

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

    verify = subparsers.add_parser("verify", help="Trigger verification flows")
    verify.add_argument("--crypto", action="store_true", help="Submit post-quantum attestation")
    verify.add_argument("--target", default="vaultfire-cli", help="Target module identifier")

    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = create_parser()
    args = parser.parse_args(argv)
    pilot = bool(getattr(args, "pilot", False))
    if getattr(args, "recover", False):
        return handle_recover(pilot=pilot)
    if args.command is None:
        parser.error("command required unless --recover is provided")
    if args.command == "deploy":
        return handle_deploy(args.profile, pilot=pilot)
    if args.command == "fade":
        return handle_fade(args.persona, pilot=pilot)
    if args.command == "drift":
        return handle_drift(args.simulate, pilot=pilot)
    if args.command == "test":
        return handle_test(args.all)
    if args.command == "cloak":
        if not args.status:
            parser.error("cloak command requires --status")
        return handle_cloak_status(pilot=pilot)
    if args.command == "verify":
        return handle_verify(crypto=args.crypto, target=args.target, pilot=pilot)
    parser.error("Unknown command")


__all__ = [
    "create_parser",
    "handle_cloak_status",
    "handle_deploy",
    "handle_drift",
    "handle_fade",
    "handle_recover",
    "handle_verify",
    "handle_test",
    "main",
]

