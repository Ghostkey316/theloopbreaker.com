import argparse
import base64
import hashlib
import json
from pathlib import Path
import time
import zipfile
from typing import Any, Dict, List, Mapping

from mobile_mode import MOBILE_MODE
from vaultfire.x402_dashboard import aggregate_totals, export_dashboard, load_dashboard_entries
from vaultfire.x402_gateway import (
    X402GatewayOffline,
    X402PaymentRequired,
    get_default_gateway,
)

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


def cmd_x402_dashboard(args: argparse.Namespace) -> None:
    """Render the x402 earnings dashboard."""

    entries = load_dashboard_entries(limit=args.limit)
    totals = aggregate_totals(entries)
    payload = {"events": entries, "totals": totals}
    if not args.quiet:
        print(json.dumps(payload, indent=2))
    if args.export:
        destination = Path(args.export)
        export_dashboard(entries, destination, format=args.format)
        print(f"Dashboard exported to {destination}")


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


def cmd_sync_identity(args: argparse.Namespace) -> None:
    """Broadcast identity attestations across supported chains."""

    from vaultfire.trust.ccip import (
        broadcast_belief_cross_chain,
        supported_chains,
        sync_identity_all_chains,
    )

    payload = {
        "identity": args.identity,
        "ens": args.ens,
        "wallet": args.wallet,
    }
    payload = {key: value for key, value in payload.items() if value}

    if args.all_chains:
        results = sync_identity_all_chains(payload)
    else:
        if not args.chain:
            choices = ", ".join(supported_chains())
            raise SystemExit(f"--chain required unless --all-chains (options: {choices})")
        enriched = dict(payload)
        enriched.setdefault("signal", "identity-sync")
        enriched.setdefault("origin", "vaultfire")
        results = [broadcast_belief_cross_chain(args.chain, enriched)]

    print(json.dumps(results, indent=2))


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


class VaultCacheManager:
    """Persist and replay CLI actions captured while offline."""

    def __init__(self, path: Path | None = None) -> None:
        self.path = path or Path(".vaultcache")

    # ------------------------------------------------------------------
    # internal helpers
    # ------------------------------------------------------------------
    def _load(self) -> Dict[str, Any]:
        if self.path.exists():
            try:
                with self.path.open("r", encoding="utf-8") as fp:
                    data = json.load(fp)
            except (json.JSONDecodeError, OSError):
                return {"pending": [], "last_synced": None}
            if isinstance(data, dict):
                data.setdefault("pending", [])
                data.setdefault("last_synced", None)
                return data
        return {"pending": [], "last_synced": None}

    def _write(self, data: Mapping[str, Any]) -> None:
        tmp_path = self.path.with_suffix(".tmp")
        tmp_path.parent.mkdir(parents=True, exist_ok=True)
        with tmp_path.open("w", encoding="utf-8") as fp:
            json.dump(data, fp, indent=2)
        tmp_path.replace(self.path)

    def _serialise_metadata(self, metadata: Mapping[str, Any]) -> Dict[str, Any]:
        if isinstance(metadata, dict):
            payload: Dict[str, Any] = dict(metadata)
        else:
            payload = dict(metadata)
        try:
            json.dumps(payload)
        except TypeError:
            payload = json.loads(json.dumps(payload, default=str))
        return payload

    def _compute_hash(self, entry: Mapping[str, Any]) -> str:
        digest_input = json.dumps(
            {
                "endpoint": entry.get("endpoint"),
                "metadata": entry.get("metadata"),
                "amount": entry.get("amount"),
                "currency": entry.get("currency"),
                "billable": entry.get("billable"),
                "timestamp": entry.get("timestamp"),
            },
            sort_keys=True,
            separators=(",", ":"),
        )
        return hashlib.sha256(digest_input.encode("utf-8")).hexdigest()

    def _ledger_has_hash(self, gateway, entry_hash: str) -> bool:
        path = getattr(gateway, "ledger_path", None)
        if path is None:
            return False
        try:
            with path.open("r", encoding="utf-8") as fp:
                for line in fp:
                    try:
                        payload = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    metadata = payload.get("metadata") or {}
                    if metadata.get("buffer_hash") == entry_hash:
                        return True
        except FileNotFoundError:
            return False
        except OSError:
            return False
        return False

    # ------------------------------------------------------------------
    # public API
    # ------------------------------------------------------------------
    def build_entry(
        self,
        *,
        endpoint: str,
        metadata: Mapping[str, Any],
        amount: float | None,
        currency: str | None,
        billable: bool,
        command: str | None,
    ) -> Dict[str, Any]:
        payload = self._serialise_metadata(metadata)
        entry: Dict[str, Any] = {
            "endpoint": endpoint,
            "metadata": payload,
            "amount": amount,
            "currency": currency,
            "billable": billable,
            "command": command,
            "timestamp": time.time(),
        }
        entry["hash"] = self._compute_hash(entry)
        return entry

    def queue(self, entry: Mapping[str, Any]) -> bool:
        data = self._load()
        pending: List[Dict[str, Any]] = [
            item for item in data.get("pending", []) if isinstance(item, dict)
        ]
        entry_hash = entry.get("hash")
        if any(item.get("hash") == entry_hash for item in pending):
            return False
        pending.append(dict(entry))
        data["pending"] = pending
        self._write(data)
        return True

    def flush(self, gateway) -> Dict[str, Any]:
        data = self._load()
        pending: List[Dict[str, Any]] = [
            item for item in data.get("pending", []) if isinstance(item, dict)
        ]
        processed = 0
        skipped = 0
        offline = False
        remaining: List[Dict[str, Any]] = []
        for entry in pending:
            if offline:
                remaining.append(entry)
                continue
            entry_hash = entry.get("hash")
            if entry_hash and self._ledger_has_hash(gateway, entry_hash):
                skipped += 1
                continue
            metadata = dict(entry.get("metadata", {}))
            if entry_hash:
                metadata["buffer_hash"] = entry_hash
            metadata.setdefault("buffered", True)
            metadata.setdefault("buffer_timestamp", entry.get("timestamp"))
            try:
                gateway.execute(
                    entry.get("endpoint", "cli.vaultfire.sh"),
                    lambda: None,
                    amount=entry.get("amount"),
                    currency=entry.get("currency"),
                    metadata=metadata,
                    billable=entry.get("billable"),
                )
            except (X402GatewayOffline, ConnectionError, TimeoutError, OSError):
                offline = True
                remaining.append(entry)
            except X402PaymentRequired:
                remaining.append(entry)
            else:
                processed += 1
        data["pending"] = remaining
        if processed or (skipped and not offline):
            data["last_synced"] = time.time()
        self._write(data)
        return {
            "processed": processed,
            "skipped": skipped,
            "remaining": len(remaining),
            "offline": offline,
        }

    def status(self) -> Dict[str, Any]:
        data = self._load()
        pending: List[Dict[str, Any]] = [
            item for item in data.get("pending", []) if isinstance(item, dict)
        ]
        queued = len(pending)
        timestamps = [item.get("timestamp") for item in pending if item.get("timestamp")]
        commands = sorted({item.get("command") or "unknown" for item in pending}) if pending else []
        return {
            "queued": queued,
            "last_synced": data.get("last_synced"),
            "oldest_timestamp": min(timestamps) if timestamps else None,
            "newest_timestamp": max(timestamps) if timestamps else None,
            "commands": commands,
            "hashes": [item.get("hash") for item in pending],
        }


_BUFFER = VaultCacheManager()


_OFFLINE_EXCEPTIONS: tuple[type[BaseException], ...] = (
    X402GatewayOffline,
    ConnectionError,
    TimeoutError,
    OSError,
)


def _queue_buffered_action(
    *, endpoint: str, command: str | None, metadata: Mapping[str, Any], buffer: VaultCacheManager
) -> str:
    rules = _X402_GATEWAY.describe_rules()
    rule = rules.get(endpoint, {}) if isinstance(rules, dict) else {}
    default_amount = rule.get("default_amount") if isinstance(rule, dict) else None
    currency = rule.get("currency") if isinstance(rule, dict) else None
    minimum_charge = 0.0
    if isinstance(rule, dict):
        try:
            minimum_charge = float(rule.get("minimum_charge", 0) or 0)
        except (TypeError, ValueError):
            minimum_charge = 0.0
    billable = bool(default_amount) or minimum_charge > 0
    entry = buffer.build_entry(
        endpoint=endpoint,
        metadata=dict(metadata),
        amount=default_amount,
        currency=currency,
        billable=billable,
        command=command,
    )
    queued = buffer.queue(entry)
    action_hash = entry.get("hash", "")
    label = command or endpoint
    location = buffer.path
    if queued:
        print(
            f"Gateway offline. Buffered '{label}' for later sync "
            f"(hash {action_hash[:12]}...) -> {location}"
        )
    else:
        print(
            f"Buffered action '{label}' already pending (hash {action_hash[:12]}...)."
        )
    return action_hash


def _announce_flush(report: Mapping[str, Any]) -> None:
    processed = int(report.get("processed", 0) or 0)
    skipped = int(report.get("skipped", 0) or 0)
    remaining = int(report.get("remaining", 0) or 0)
    offline = bool(report.get("offline"))
    if processed:
        message = f"Synced {processed} buffered action(s)"
        if skipped:
            message += f"; skipped {skipped} duplicate(s)"
        if remaining:
            message += f"; {remaining} still queued"
        print(message)
    elif skipped and not offline:
        print(f"Skipped {skipped} duplicate buffered action(s).")
    elif offline and remaining:
        print(f"x402 gateway offline – {remaining} buffered action(s) pending.")


def _print_buffer_status(status: Mapping[str, Any], flush_report: Mapping[str, Any]) -> None:
    payload = dict(status)
    payload["flush"] = dict(flush_report)
    print(json.dumps(payload, indent=2))


def _execute_with_gateway(
    args: argparse.Namespace,
    *,
    endpoint: str,
    metadata: Mapping[str, Any],
    buffer: VaultCacheManager,
) -> None:
    callback_executed = False

    def callback() -> Any:
        nonlocal callback_executed
        callback_executed = True
        return args.func(args)

    try:
        _X402_GATEWAY.execute(endpoint, callback, metadata=dict(metadata))
    except X402PaymentRequired:
        raise
    except _OFFLINE_EXCEPTIONS as exc:
        if not callback_executed:
            args.func(args)
        _queue_buffered_action(
            endpoint=endpoint,
            command=getattr(args, "command", None),
            metadata=dict(metadata),
            buffer=buffer,
        )
        message = str(exc).strip()
        if message:
            print(f"x402 gateway unavailable; buffered action ({message}).")
        else:
            print("x402 gateway unavailable; buffered action for later sync.")


def _resolve_cli_endpoint(command: str) -> str:
    if command == "unlock":
        return "cli.nft_gateway_unlock"
    if command == "media":
        return "cli.codex_engine_pulse"
    return "cli.vaultfire.sh"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="vaultfire-cli", description="Vaultfire multi-tool")
    parser.add_argument(
        "--buffer",
        action="store_true",
        help="Show offline buffer status and exit",
    )
    sub = parser.add_subparsers(dest="command")

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

    p_dashboard = sub.add_parser("x402-dashboard", help="Inspect x402 earnings")
    p_dashboard.add_argument("--limit", type=int, default=20, help="Number of events to include")
    p_dashboard.add_argument("--export", help="Destination file for export")
    p_dashboard.add_argument("--format", choices=["vaultledger", "json"], default="vaultledger")
    p_dashboard.add_argument("--quiet", action="store_true", help="Suppress stdout output")
    p_dashboard.set_defaults(func=cmd_x402_dashboard)

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

    p_identity = sub.add_parser("sync-identity", help="Broadcast identity attestations")
    p_identity.add_argument("--identity", default="Ghostkey-316", help="Identity label")
    p_identity.add_argument("--ens", default="ghostkey316.eth", help="ENS name")
    p_identity.add_argument("--wallet", default="bpow20.cb.id", help="Wallet alias")
    p_identity.add_argument("--chain", help="Destination chain when not syncing all")
    p_identity.add_argument("--all-chains", action="store_true", help="Sync to all supported chains")
    p_identity.set_defaults(func=cmd_sync_identity)

    args = parser.parse_args(argv)

    flush_report = _BUFFER.flush(_X402_GATEWAY)
    _announce_flush(flush_report)

    if getattr(args, "buffer", False):
        _print_buffer_status(_BUFFER.status(), flush_report)
        if args.command is None:
            return 0

    if args.command is None:
        parser.error("command required")

    endpoint = _resolve_cli_endpoint(args.command)
    metadata = {
        "source": "vaultfire-cli",
        "command": args.command,
        "wallet": getattr(args, "wallet", None),
    }
    try:
        _execute_with_gateway(args, endpoint=endpoint, metadata=metadata, buffer=_BUFFER)
    except X402PaymentRequired as exc:
        print(exc.user_message())
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
