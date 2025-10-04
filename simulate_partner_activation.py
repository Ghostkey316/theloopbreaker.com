"""Offline simulation of the partner activation handshake."""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import time
from datetime import datetime
from pathlib import Path
from typing import Iterable

from engine import storage
from engine.loyalty_engine import update_loyalty_ranks
from engine.identity_resolver import resolve_identity
from system_integrity_check import run_integrity_check
from vaultfire.ghost_audit import GhostAuditLogger

BASE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = BASE_DIR / "vaultfire-core" / "vaultfire_config.json"
PARTNERS_PATH = BASE_DIR / "partners.json"
ALIGNMENT_PHRASE = "Morals Before Metrics."

logger = logging.getLogger("vaultfire.partner_activation")
_AUDIT_LOGGER = GhostAuditLogger()


def simulate_activation(
    partner_id: str,
    wallets: list[str],
    phrase: str = ALIGNMENT_PHRASE,
    test_mode: bool = False,
    *,
    audit_logger: GhostAuditLogger | None = None,
    redact_sensitive: bool | None = None,
    validators: Iterable[str] | None = None,
) -> dict:
    """Run activation checks and return a result object with audit logging."""

    started = time.monotonic()
    audit_logger = audit_logger or _AUDIT_LOGGER

    failures: list[str] = []
    decision_tree: list[dict[str, object]] = []

    partner_present = bool(partner_id)
    decision_tree.append(
        {
            "id": "inputs.partner_id",
            "description": "Partner identifier supplied",
            "observed": "present" if partner_present else "missing",
            "outcome": "pass" if partner_present else "fail",
        }
    )
    if not partner_present:
        failures.append("partner_id missing")

    wallets_present = bool(wallets)
    decision_tree.append(
        {
            "id": "inputs.wallet_roster",
            "description": "Wallet roster provided",
            "observed": len(wallets),
            "outcome": "pass" if wallets_present else "fail",
        }
    )
    if not wallets_present:
        failures.append("wallets missing")

    phrase_ok = check_alignment_phrase(phrase)
    decision_tree.append(
        {
            "id": "controls.alignment_phrase",
            "description": "Alignment phrase matches canonical charter",
            "observed": "match" if phrase_ok else "mismatch",
            "outcome": "pass" if phrase_ok else "fail",
        }
    )
    if not phrase_ok:
        failures.append("alignment phrase mismatch")

    ethics_ok = check_ethics_anchor()
    decision_tree.append(
        {
            "id": "controls.ethics_anchor",
            "description": "Ethics anchor enabled in configuration",
            "observed": ethics_ok,
            "outcome": "pass" if ethics_ok else "fail",
        }
    )
    if not ethics_ok:
        failures.append("ethics_anchor disabled")

    loyalty_ok = init_loyalty_engine()
    decision_tree.append(
        {
            "id": "systems.loyalty_engine",
            "description": "Loyalty engine initialised",
            "observed": loyalty_ok,
            "outcome": "pass" if loyalty_ok else "fail",
        }
    )
    if not loyalty_ok:
        failures.append("loyalty_engine initialization failed")

    success = not failures
    resolved_wallets = resolve_wallets(wallets) if success else wallets
    activation_recorded = False
    if success and not test_mode:
        activate_partner(partner_id, wallets, resolved_wallets)
        activation_recorded = True

    decision_tree.append(
        {
            "id": "outcome.activation",
            "description": "Overall activation status",
            "observed": "activated" if success else "blocked",
            "outcome": "pass" if success else "fail",
            "notes": failures if not success else ["All readiness checks satisfied."],
        }
    )

    result = {
        "partner_id": partner_id,
        "wallets": resolved_wallets,
        "input_wallets": wallets,
        "phrase": phrase,
        "success": success,
        "failures": failures,
        "status": "PASS" if success else "FAIL",
        "integration_readiness": "10/10" if success else "0/10",
    }

    duration_ms = round((time.monotonic() - started) * 1000, 3)
    performance_metrics = {
        "duration_ms": duration_ms,
        "checks_total": len(decision_tree),
        "checks_failed": len(failures),
        "wallets_submitted": len(wallets),
        "activation_recorded": activation_recorded,
        "success": success,
    }

    run_context = {
        "partner_id": partner_id,
        "wallets": wallets,
        "resolved_wallets": resolved_wallets,
        "test_mode": test_mode,
        "phrase": phrase,
    }

    try:
        audit_logger.log_simulation(
            protocol_name="partner_activation",
            scenario=partner_id or "unassigned-partner",
            decision_tree={"nodes": decision_tree},
            performance=performance_metrics,
            run_context=run_context,
            outcome=result,
            protocol_version="activation.v1",
            validators=validators,
            redact_sensitive=redact_sensitive,
        )
    except Exception as exc:  # pragma: no cover - audit logging must not break flow
        logger.warning("Failed to persist GhostAudit record: %s", exc)

    return result


def _load_json(path: Path, default):
    return storage.load_data(path, default)


def _write_json(path: Path, data) -> None:
    storage.write_data(path, data)


def _alignment_signature(phrase: str) -> str:
    """Return a deterministic signature for the alignment phrase."""
    normalized = phrase.strip().lower().encode("utf-8")
    return hashlib.sha256(normalized).hexdigest()


def check_ethics_anchor() -> bool:
    """Return ``True`` if the ethics anchor is enabled."""
    cfg = _load_json(CONFIG_PATH, {})
    return cfg.get("ethics_anchor", False)


def check_alignment_phrase(phrase: str) -> bool:
    """Validate the provided alignment ``phrase`` (case-insensitive)."""
    return phrase.strip().lower() == ALIGNMENT_PHRASE.lower()


def init_loyalty_engine() -> bool:
    """Initialize the loyalty engine."""
    try:
        update_loyalty_ranks()
    except Exception:
        return False
    return True


def resolve_wallets(wallets: list[str]) -> list[str]:
    """Resolve wallet identifiers for future Web3 integration."""
    resolved = []
    for w in wallets:
        addr = resolve_identity(w) or w
        resolved.append(addr)
    return resolved


def activate_partner(partner_id: str, wallets: list[str],
                    resolved_wallets: list[str]) -> None:
    """Persist partner info if not already recorded."""
    partners = _load_json(PARTNERS_PATH, [])
    if any(p.get("partner_id") == partner_id for p in partners):
        return
    timestamp = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
    entry = {
        "partner_id": partner_id,
        "wallet": resolved_wallets[0],
        "wallet_alias": wallets[0],
        "resolved_wallet": resolved_wallets[0],
        "alignment_signature": _alignment_signature(ALIGNMENT_PHRASE),
        "onboarded_at": timestamp,
    }
    if len(wallets) > 1:
        entry["wallets"] = resolved_wallets
        entry["wallet_aliases"] = wallets
    partners.append(entry)
    _write_json(PARTNERS_PATH, partners)


def activation_hook(partner_id: str, wallets: list[str],
                    phrase: str = ALIGNMENT_PHRASE,
                    silent: bool = False,
                    test_mode: bool = False) -> dict:
    """Run activation and integrity checks and return a result object."""
    activation = simulate_activation(partner_id, wallets, phrase, test_mode)
    integrity = run_integrity_check()
    errors = activation["failures"][:]
    for section, msgs in integrity.items():
        errors.extend(f"{section}: {m}" for m in msgs)
    status = "PASS" if not errors else "FAIL"
    result = {
        "partner_id": partner_id,
        "wallets": activation["wallets"],
        "status": status,
        "errors": errors,
        "activation": activation,
        "integrity": integrity,
        "integration_readiness": "10/10" if not errors else "0/10",
    }
    if not silent:
        print(json.dumps(result, indent=2))
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Simulate partner activation")
    parser.add_argument("partner_id", help="unique partner identifier")
    parser.add_argument("wallet", nargs="+", help="one or more wallet identifiers")
    parser.add_argument("--phrase", default=ALIGNMENT_PHRASE, help="alignment phrase")
    parser.add_argument("--silent", action="store_true", help="suppress console output")
    parser.add_argument("--test-mode", action="store_true", help="do not persist changes")
    parser.add_argument("--hook", action="store_true", help="return JSON activation hook output")
    args = parser.parse_args(argv)

    partner_id = args.partner_id
    wallets = args.wallet
    alignment_phrase = args.phrase
    silent = args.silent
    test_mode = args.test_mode

    if args.hook:
        result = activation_hook(partner_id, wallets, alignment_phrase,
                                 silent=silent, test_mode=test_mode)
        return 0 if result["status"] == "PASS" else 1

    if not silent:
        print("Starting partner activation handshake...")
    result = simulate_activation(partner_id, wallets, alignment_phrase, test_mode)

    if not result["success"]:
        if not silent:
            print("Activation failed due to:")
            for msg in result["failures"]:
                print(f"- {msg}")
            print("System integration readiness: FAIL")
        return 1

    if not silent:
        print("Activation successful for partner", partner_id)
        print("System integration readiness: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
