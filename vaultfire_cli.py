import argparse
import json
from pathlib import Path
import zipfile

from engine.self_audit import run_self_audit
from simulate_partner_activation import activation_hook, ALIGNMENT_PHRASE
from system_integrity_check import run_integrity_check
from update_ens_text_records import (
    get_web3,
    load_text_records,
    diff_records,
    update_records,
    FIELDS,
)
from ens import ENS


def cmd_sync_ens(args: argparse.Namespace) -> None:
    """Sync ENS text records for the given name."""
    w3 = get_web3()
    ns = ENS.from_web3(w3)
    current = load_text_records(ns, args.name, FIELDS.keys())
    mismatched = diff_records(current, FIELDS)
    if not mismatched:
        print("All text records already in sync")
        return
    update_records(ns, args.name, mismatched)


def cmd_partner_audit(_: argparse.Namespace) -> None:
    """Run partner self audit and print the result."""
    result = run_self_audit()
    print(json.dumps(result, indent=2))


def cmd_belief_onboard(args: argparse.Namespace) -> None:
    """Trigger belief-aligned onboarding for a partner."""
    result = activation_hook(
        args.partner_id,
        args.wallets,
        phrase=args.phrase,
        silent=True,
        test_mode=args.test_mode,
    )
    print(json.dumps(result, indent=2))


def cmd_monitor_integrity(_: argparse.Namespace) -> None:
    """Run system integrity checks."""
    result = run_integrity_check()
    print(json.dumps(result, indent=2))


def cmd_export_logs(args: argparse.Namespace) -> None:
    """Archive the logs directory into a zip file."""
    logs_dir = Path("logs")
    if not logs_dir.exists():
        print("logs directory does not exist")
        return
    out_path = Path(args.output)
    with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in logs_dir.rglob("*"):
            if path.is_file():
                zf.write(path, path.relative_to(logs_dir))
    print(f"Logs exported to {out_path}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="vaultfire-cli", description="Vaultfire multi-tool")
    sub = parser.add_subparsers(dest="command", required=True)

    p_sync = sub.add_parser("sync-ens", help="Sync ENS text records")
    p_sync.add_argument("name", help="ENS name")
    p_sync.set_defaults(func=cmd_sync_ens)

    p_audit = sub.add_parser("partner-audit", help="Run partner self audit")
    p_audit.set_defaults(func=cmd_partner_audit)

    p_onboard = sub.add_parser("belief-onboard", help="Trigger belief-aligned onboarding")
    p_onboard.add_argument("partner_id", help="Partner identifier")
    p_onboard.add_argument("wallets", nargs="+", help="One or more wallet identifiers")
    p_onboard.add_argument("--phrase", default=ALIGNMENT_PHRASE, help="Alignment phrase")
    p_onboard.add_argument("--test-mode", action="store_true", help="Do not persist changes")
    p_onboard.set_defaults(func=cmd_belief_onboard)

    p_integrity = sub.add_parser("monitor-integrity", help="Run integrity checks")
    p_integrity.set_defaults(func=cmd_monitor_integrity)

    p_logs = sub.add_parser("export-logs", help="Export logs as zip")
    p_logs.add_argument("--output", default="logs.zip", help="Output zip file")
    p_logs.set_defaults(func=cmd_export_logs)

    args = parser.parse_args(argv)
    args.func(args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
