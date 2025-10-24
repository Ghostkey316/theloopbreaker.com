#!/usr/bin/env python3
"""Vaultfire Protocol system readiness checker.

This script ensures that core Vaultfire files exist, performs a
validation sweep, and sets a readiness flag when all checks pass.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Tuple

BASE_DIR = Path(__file__).resolve().parent
AUDIT_PATH = BASE_DIR / "vaultfire_audit_report.txt"
READY_FLAG_PATH = BASE_DIR / "vaultfire_ready.flag"
PARTNER_FORK_PATH = BASE_DIR / "vaultbundle_partner_fork.json"
ATTESTATION_DIR = BASE_DIR / "attestations"
LOGS_DIR = BASE_DIR / "logs"

@dataclass
class CheckResult:
    """Represents the outcome of a readiness check."""

    name: str
    status: str
    details: Dict[str, Any]


CORE_FILES = {
    "vaultfire_core.py": """from pathlib import Path
import json
from datetime import datetime
from engine.proof_of_loyalty import record_belief_action

PURPOSE_MAP_PATH = Path('purpose_map.json')


def sync_purpose(domain: str, trait: str, role: str) -> dict:
    record = {
        'domain': domain,
        'trait': trait,
        'role': role,
        'timestamp': datetime.utcnow().isoformat()
    }
    try:
        data = json.loads(PURPOSE_MAP_PATH.read_text())
    except Exception:
        data = {'records': []}
    data.setdefault('records', []).append(record)
    PURPOSE_MAP_PATH.write_text(json.dumps(data, indent=2))
    return record


def cli_belief(identity: str, wallet: str, text: str) -> dict:
    result = record_belief_action(identity, wallet, text)
    sync_purpose('cli', 'belief', 'record')
    return result
""",
    "fanforge_vr.py": """from pathlib import Path
import json
from datetime import datetime
import ghostseat
from engine.proof_of_loyalty import record_belief_action

LOG_PATH = Path('fanforge_vr_log.json')


def vr_check_in(identity: str, team: str) -> str:
    seat = ghostseat.assign_seat(identity, team)
    ghostseat.log_reaction(identity, seat, 'checkin')
    record_belief_action(identity, identity, f'{team} check-in')
    try:
        log = json.loads(LOG_PATH.read_text())
    except Exception:
        log = []
    log.append({'timestamp': datetime.utcnow().isoformat(), 'identity': identity, 'team': team})
    LOG_PATH.write_text(json.dumps(log, indent=2))
    return seat


def record_memory(identity: str, text: str) -> None:
    record_belief_action(identity, identity, text)
""",
    "loyalty_engine.py": """from engine.loyalty_engine import (
    loyalty_score,
    loyalty_enhanced_score,
    update_loyalty_ranks,
)

__all__ = ['loyalty_score', 'loyalty_enhanced_score', 'update_loyalty_ranks']
""",
    "ghostkey_registry.json": {"entries": []},
    "purpose_map.json": {"domains": {}, "traits": {}, "roles": {}, "records": [], "last_sync": ""},
}


# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------

def _log(msg: str) -> None:
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    AUDIT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(AUDIT_PATH, "a") as f:
        f.write(f"[{timestamp}] {msg}\n")


def _ensure_files() -> None:
    for name, content in CORE_FILES.items():
        path = BASE_DIR / name
        if not path.exists():
            if isinstance(content, str):
                path.write_text(content)
            else:
                path.write_text(json.dumps(content, indent=2))
            _log(f"created {name}")

    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    ATTESTATION_DIR.mkdir(parents=True, exist_ok=True)


def _validate_scripts() -> Tuple[List[str], Dict[str, str]]:
    errors: List[str] = []
    modules: Dict[str, str] = {}
    for mod in ("vaultfire_core", "fanforge_vr", "loyalty_engine"):
        try:
            __import__(mod)
            modules[mod] = "imported"
        except Exception as e:  # pragma: no cover - runtime validation
            errors.append(f"{mod} failed to import: {e}")
    return errors, modules


def _validate_files() -> Tuple[List[str], Dict[str, str]]:
    errors: List[str] = []
    summary: Dict[str, str] = {}
    json_paths = [BASE_DIR / "ghostkey_registry.json", BASE_DIR / "purpose_map.json"]
    csv_paths = [BASE_DIR / "fan_cred_log.csv"]

    for path in json_paths:
        if not path.exists():
            errors.append(f"missing {path.name}")
            continue
        try:
            json.loads(path.read_text())
            summary[path.name] = "valid"
        except Exception as e:
            errors.append(f"invalid json in {path.name}: {e}")

    for path in csv_paths:
        if not path.exists():
            path.write_text("timestamp,identity,action,value,detail\n")
            _log(f"created {path.name}")
            summary[path.name] = "created"
        else:
            try:
                list(csv.reader(path.read_text().splitlines()))
                summary[path.name] = "valid"
            except Exception as e:
                errors.append(f"invalid csv in {path.name}: {e}")
    return errors, summary


def _simulate_actions() -> Tuple[List[str], Dict[str, str]]:
    errors: List[str] = []
    details: Dict[str, str] = {}
    try:
        import vaultfire_core
        import fanforge_vr

        vaultfire_core.cli_belief("demo", "demo", "belief test")
        fanforge_vr.record_memory("demo", "memory test")
        fanforge_vr.vr_check_in("demo", "team")
        details["belief"], details["memory"], details["check_in"] = (
            "ok",
            "ok",
            "ok",
        )
    except Exception as e:
        errors.append(f"action simulation failed: {e}")

    try:
        from engine import purposeful_scale

        guardian_identity = {
            "ens": "guardian.eth",
            "wallet": "guardian.wallet",
            "missionTags": ["Vaultfire", "NS3", "Ghostkey-316"],
            "beliefDensity": purposeful_scale.DEFAULT_BELIEF_THRESHOLD + 0.2,
            "declaredPurpose": (
                "Safeguard Vaultfire, NS3, and Ghostkey-316 mission threads with moral coherence"
            ),
        }

        mission = purposeful_scale.ensure_mission_profile("guardian.eth", guardian_identity)

        scale_request = {
            "operation": "system.readiness",
            "mission_tags": guardian_identity["missionTags"],
            "declared_purpose": mission,
            "belief_density": guardian_identity["beliefDensity"],
        }

        purposeful_scale.belief_trace(
            "guardian.eth",
            scale_request,
            identity=guardian_identity,
        )

        purposeful_scale.behavioral_resonance_filter("guardian.eth", scale_request)

        purposeful_scale.generate_attestation_pack("guardian.eth", history_limit=5)
        details["purposeful_scale"] = "ok"
    except Exception as e:
        errors.append(f"purposeful scale simulation failed: {e}")
    return errors, details


def _validate_scaling_stack() -> Tuple[List[str], Dict[str, Any]]:
    """Run lightweight validation over the scaling orchestration helpers."""

    try:
        from vaultfire_scaling import (
            deploy_partner_plugins,
            fork_agent_relay,
            init_vaultfire_dao,
            launch_gui_layer,
            open_api_gateway,
            sync_beliefnet,
        )
    except Exception as exc:  # pragma: no cover - import validation
        return [f"scaling stack import failed: {exc}"], {}

    errors: List[str] = []
    snapshot: Dict[str, Any] = {}

    try:
        gui_state = launch_gui_layer(
            theme="PartnerReady",
            lineage_trace="ghostkey316.eth",
            embedded_modules=(),
        )
        snapshot["gui_layer"] = {
            "theme": gui_state.theme,
            "modules": [module.name for module in gui_state.modules],
        }
    except Exception as exc:
        errors.append(f"GUI layer bootstrap failed: {exc}")

    try:
        api_state = open_api_gateway(
            auth_required=True,
            endpoints=("/deploy", "/status"),
            attached_wallet="ghostkey316.partner",
        )
        snapshot["api_gateway"] = {
            "auth_required": api_state.auth_required,
            "endpoints": list(api_state.endpoints),
        }
    except Exception as exc:
        errors.append(f"API gateway validation failed: {exc}")

    try:
        sync_state = sync_beliefnet(
            moral_fingerprint=("ethics", "guardianship"),
            fallback_to="SanctumLoop",
            entropy_source="EntropySeedNetwork",
        )
        snapshot["beliefnet"] = {
            "fingerprint_size": len(sync_state.moral_fingerprint),
            "fallback": sync_state.fallback_to,
        }
    except Exception as exc:
        errors.append(f"BeliefNet sync failed: {exc}")

    try:
        plugin_state = deploy_partner_plugins(
            ["NS3-Agent-Bridge", "OpenAI-LoopSync", "Worldcoin-AccessNode"],
        )
        snapshot["plugins"] = list(plugin_state.deployed)
    except Exception as exc:
        errors.append(f"Partner plugin deployment failed: {exc}")

    try:
        relay_state = fork_agent_relay(
            behavior_model="Ghostkey-Mirror",
            relay_count=3,
            sync_pulse={"primary": {"status": "ok"}},
        )
        snapshot["agent_relays"] = list(relay_state.relays)
    except Exception as exc:
        errors.append(f"Agent relay validation failed: {exc}")

    try:
        dao_state = init_vaultfire_dao(
            founding_address="ghostkey316.partner",
            proposal_engine="SignalDriven",
            fallback_moral_filter=("ethics", "coherence"),
        )
        snapshot["dao"] = {
            "founding_address": dao_state.founding_address,
            "proposal_engine": dao_state.proposal_engine,
        }
    except Exception as exc:
        errors.append(f"VaultfireDAO bootstrap failed: {exc}")

    return errors, snapshot


def _generate_attestation(user_id: str, history_limit: int | None) -> Tuple[Path, Dict[str, Any]]:
    from engine import purposeful_scale

    guardian_identity = {
        "ens": user_id,
        "wallet": f"{user_id}.vaultfire",
        "missionTags": ["Vaultfire", "NS3", "Ghostkey-316"],
        "beliefDensity": purposeful_scale.DEFAULT_BELIEF_THRESHOLD + 0.15,
        "declaredPurpose": (
            "Safeguard Vaultfire, NS3, and Ghostkey-316 mission threads with moral coherence"
        ),
    }

    purposeful_scale.ensure_mission_profile(user_id, guardian_identity)
    attestation = purposeful_scale.generate_attestation_pack(
        user_id,
        history_limit=history_limit,
        include_index=True,
    )
    destination = ATTESTATION_DIR / f"{user_id.replace('/', '_')}_attestation.json"
    destination.write_text(json.dumps(attestation, indent=2))
    _log(f"generated attestation for {user_id}")
    return destination, attestation


def _generate_partner_fork(wallet: str) -> None:
    data = {
        "partner_wallet": wallet,
        "traits": ["origin"],
        "loyalty_tier": "default",
        "fork_origin": "ghostkey316.eth",
    }
    PARTNER_FORK_PATH.write_text(json.dumps(data, indent=2))
    _log(f"wrote {PARTNER_FORK_PATH.name}")


def _system_hash() -> str:
    h = hashlib.sha256()
    for name in sorted(CORE_FILES.keys()):
        path = BASE_DIR / name
        if path.exists():
            h.update(path.read_bytes())
    return h.hexdigest()


# ---------------------------------------------------------------------------
# Main execution
# ---------------------------------------------------------------------------

def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Vaultfire system readiness")
    parser.add_argument("--partner-mode", metavar="WALLET", help="generate partner fork")
    parser.add_argument(
        "--attest",
        metavar="USER",
        help="generate a purposeful scale attestation for USER",
    )
    parser.add_argument(
        "--attest-history",
        metavar="N",
        type=int,
        default=10,
        help="limit the attestation decision history (default: 10)",
    )
    parser.add_argument(
        "--report",
        metavar="DEST",
        nargs="?",
        const="-",
        help="emit a readiness report to DEST (use '-' for stdout)",
    )
    args = parser.parse_args(argv)

    _ensure_files()

    check_results: List[CheckResult] = []

    issues: List[str] = []

    script_errors, module_summary = _validate_scripts()
    issues += script_errors
    check_results.append(
        CheckResult(
            name="core_modules",
            status="pass" if not script_errors else "fail",
            details=module_summary,
        )
    )

    file_errors, file_summary = _validate_files()
    issues += file_errors
    check_results.append(
        CheckResult(
            name="data_files",
            status="pass" if not file_errors else "fail",
            details=file_summary,
        )
    )

    action_errors, action_summary = _simulate_actions()
    issues += action_errors
    check_results.append(
        CheckResult(
            name="simulated_actions",
            status="pass" if not action_errors else "fail",
            details=action_summary,
        )
    )

    scaling_errors, scaling_snapshot = _validate_scaling_stack()
    issues += scaling_errors
    check_results.append(
        CheckResult(
            name="scaling_stack",
            status="pass" if not scaling_errors else "fail",
            details=scaling_snapshot,
        )
    )

    if args.partner_mode:
        _generate_partner_fork(args.partner_mode)

    if args.attest:
        try:
            path, attestation = _generate_attestation(args.attest, args.attest_history)
            _log(f"attestation stored at {path}")
            _log(f"attestation hash {attestation.get('attestation_hash')}")
        except Exception as exc:
            issues.append(f"failed to generate attestation: {exc}")

    moral_violations = []
    banned = {"gamble", "casino", "surveillance", "coercion"}
    for name in ("vaultfire_core.py", "fanforge_vr.py", "loyalty_engine.py"):
        text = (BASE_DIR / name).read_text().lower()
        if any(term in text for term in banned):
            moral_violations.append(f"banned term in {name}")
    issues += moral_violations

    report_payload = {
        "hash": _system_hash(),
        "origin": "ghostkey316.eth",
        "timestamp": datetime.utcnow().isoformat(),
        "checks": [asdict(result) for result in check_results],
        "issues": issues,
        "ready": not issues,
    }

    if args.report is not None:
        destination = args.report
        payload = json.dumps(report_payload, indent=2)
        if destination == "-":
            print(payload)
        else:
            Path(destination).write_text(payload)

    if issues:
        for msg in issues:
            _log(f"ERROR: {msg}")
        return 1

    READY_FLAG_PATH.write_text(json.dumps(report_payload, indent=2))
    _log("system ready")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
