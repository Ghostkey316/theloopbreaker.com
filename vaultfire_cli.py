import argparse
import json
from pathlib import Path
import time
import zipfile
import base64

from mobile_mode import MOBILE_MODE
from vaultfire.x402_gateway import X402PaymentRequired, get_default_gateway

if not MOBILE_MODE:
    try:
        from web3 import Web3  # type: ignore
    except Exception:  # pragma: no cover - optional dependency
        Web3 = None

    try:
        from ens import ENS  # type: ignore
    except Exception:  # pragma: no cover - optional dependency
        ENS = None
else:  # pragma: no cover - enforced mobile fallback
    Web3 = None
    ENS = None

from engine.self_audit import run_self_audit
from simulate_partner_activation import activation_hook, ALIGNMENT_PHRASE
from system_integrity_check import run_integrity_check
from engine.health_sync_engine import encrypt_data



def cmd_sync_ens(args: argparse.Namespace) -> None:
    """Sync ENS text records for the given name."""
    if Web3 is None or ENS is None:
        if MOBILE_MODE:
            print("ENS sync skipped (mobile mode)")
        else:
            print("web3 and ens packages required for ENS sync")
        return
    from update_ens_text_records import (
        get_web3,
        load_text_records,
        diff_records,
        update_records,
        FIELDS,
    )

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


def cmd_watchdog(args: argparse.Namespace) -> None:
    """Run the system watchdog loop."""
    from system_watchdog import monitor

    monitor(args.interval, repair=not args.no_repair)


def cmd_export_logs(args: argparse.Namespace) -> None:
    """Archive the logs directory into a zip file. Optionally encrypt."""
    logs_dir = Path("logs")
    if not logs_dir.exists():
        print("logs directory does not exist")
        return
    out_path = Path(args.output)
    with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in logs_dir.rglob("*"):
            if path.is_file():
                zf.write(path, path.relative_to(logs_dir))
    if args.key:
        enc_path = _encrypt_file(out_path, args.key)
        print(f"Logs exported to {enc_path} (encrypted)")
    else:
        print(f"Logs exported to {out_path}")


def cmd_partner_export(args: argparse.Namespace) -> None:
    """Write a partner export JSON payload."""
    data = {
        "wallet": args.wallet,
        "ethic": args.inject_ethic,
    }
    if args.encode_metrics:
        data["encoded_metrics"] = "VFv1.0::C316::VaultfireProtocol"
    else:
        data["encoded_metrics"] = None
    data["timestamp"] = int(time.time())
    data["version"] = "codex_fork_1.0"
    out_path = Path(args.output)
    try:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w") as f:
            json.dump(data, f, indent=2)
        print(f"Partner export written to {out_path}")
    except Exception as exc:
        print(f"Failed to write partner export: {exc}")


def _load_json(path: Path, default):
    if path.exists():
        try:
            with open(path) as f:
                return json.load(f)
        except json.JSONDecodeError:
            return default
    return default


def _write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def _encrypt_file(path: Path, key: str) -> Path:
    """Encrypt the file at ``path`` using ``key`` and return new path."""
    data_b64 = base64.urlsafe_b64encode(path.read_bytes()).decode()
    token = encrypt_data(data_b64, key)
    enc_path = path.with_suffix(path.suffix + ".enc")
    with open(enc_path, "w") as f:
        f.write(token)
    return enc_path


def cmd_media(args: argparse.Namespace) -> None:
    """Run media generation subcommands."""
    from final_modules import vaultfire_media as vm

    if args.image:
        result = vm.generate_image(args.image, args.wallet)
        print(json.dumps(result, indent=2))
    elif args.voice:
        text = vm.transcribe_audio(args.voice)
        if args.respond:
            output = {"response": vm.voice_response(text)}
        elif args.visualize:
            output = vm.generate_image(text, args.wallet)
        else:
            output = {"transcript": text}
        print(json.dumps(output, indent=2))
    elif args.video:
        result = vm.analyze_video(args.video)
        print(json.dumps(result, indent=2))
    elif args.ai_avatar:
        result = vm.build_avatar(args.wallet)
        print(json.dumps(result, indent=2))


def cmd_unlock_access(args: argparse.Namespace) -> None:
    """Verify NFT ownership and enable access hooks."""
    if Web3 is None:
        print("web3 package required for unlock")
        return
    from update_ens_text_records import get_web3

    w3 = get_web3()
    contract = w3.eth.contract(
        address=Web3.to_checksum_address(args.contract),
        abi=json.loads(Path(args.abi).read_text())
    )
    balance = contract.functions.balanceOf(Web3.to_checksum_address(args.wallet)).call()
    if balance > 0:
        cfg_path = Path("vaultfire_crypto_hooks.json")
        cfg = _load_json(cfg_path, {})
        cfg["nft_access_unlocked"] = True
        _write_json(cfg_path, cfg)
        print("Access unlocked for", args.wallet)
    else:
        print("NFT not found for", args.wallet)


_X402_GATEWAY = get_default_gateway()


def _resolve_cli_endpoint(command: str) -> str:
    if command == "unlock":
        return "cli.nft_gateway_unlock"
    if command == "media":
        return "cli.codex_engine_pulse"
    return "cli.vaultfire.sh"


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

    p_watchdog = sub.add_parser("watchdog", help="Run system watchdog")
    p_watchdog.add_argument("--interval", type=int, default=60,
                            help="Polling interval in seconds")
    p_watchdog.add_argument("--no-repair", action="store_true",
                            help="Disable automatic restoration")
    p_watchdog.set_defaults(func=cmd_watchdog)

    p_logs = sub.add_parser("export-logs", help="Export logs as zip")
    p_logs.add_argument("--output", default="logs.zip", help="Output zip file")
    p_logs.add_argument("--key", help="Encryption key")
    p_logs.set_defaults(func=cmd_export_logs)

    p_export = sub.add_parser("partner-export", help="Export partner data")
    p_export.add_argument("--wallet", required=True, help="Wallet address")
    p_export.add_argument("--inject-ethic", required=True, help="Ethics statement")
    p_export.add_argument("--encode-metrics", action="store_true", help="Include encoded metrics")
    p_export.add_argument("--output", required=True, help="Output JSON file")
    p_export.set_defaults(func=cmd_partner_export)

    p_unlock = sub.add_parser("unlock", help="Unlock access via NFT")
    p_unlock.add_argument("contract", help="ContributorUnlockKey contract")
    p_unlock.add_argument("abi", help="Path to contract ABI JSON")
    p_unlock.add_argument("wallet", help="Wallet address to check")
    p_unlock.set_defaults(func=cmd_unlock_access)

    p_media = sub.add_parser("media", help="Vaultfire media tools")
    p_media.add_argument("--wallet", default="bpow20.cb.id", help="Wallet")
    p_media.add_argument("--image")
    p_media.add_argument("--voice")
    p_media.add_argument("--respond", action="store_true")
    p_media.add_argument("--visualize", action="store_true")
    p_media.add_argument("--video")
    p_media.add_argument("--ai-avatar", action="store_true")
    p_media.set_defaults(func=cmd_media)

    args = parser.parse_args(argv)
    endpoint = _resolve_cli_endpoint(args.command)
    metadata = {
        "source": "vaultfire-cli",
        "command": args.command,
        "wallet": getattr(args, "wallet", None),
    }
    try:
        _X402_GATEWAY.execute(endpoint, lambda: args.func(args), metadata=metadata)
    except X402PaymentRequired as exc:
        print(exc.user_message())
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
