import argparse
import json
from datetime import datetime, timedelta, timezone

from vaultfire.mission import MissionLedger
from vaultfire.protocol.ghostkey_ai import GhostkeyAINetwork
from vaultfire.retroyield import BehaviorVault, LoopScanner, TokenDropper, YieldAnchor
from vaultfire.yield_config import RetroYieldConfig


def _build_runtime():
    config = RetroYieldConfig()
    ledger = MissionLedger.default(component="vaultfire.retroyield")
    ghostkey = GhostkeyAINetwork()
    behavior = BehaviorVault(config=config, ledger=ledger, ghostkey_network=ghostkey)
    anchor = YieldAnchor(behavior_vault=behavior, config=config, ledger=ledger)
    scanner = LoopScanner(
        behavior_vault=behavior,
        config=config,
        ledger=ledger,
        hash_mirror=anchor.hash_mirror,
    )
    dropper = TokenDropper(config=config, ledger=ledger, hash_mirror=anchor.hash_mirror)
    return config, ledger, ghostkey, behavior, anchor, scanner, dropper


def _parse_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value).astimezone(timezone.utc)
    except ValueError as exc:
        raise SystemExit(f"invalid timestamp: {value}") from exc


def _cmd_yield(args: argparse.Namespace) -> None:
    _, _, _, _, anchor, _, _ = _build_runtime()
    timestamp = _parse_timestamp(args.timestamp)
    record = anchor.record_action(
        args.wallet,
        args.action,
        tags=args.tag,
        weight=args.weight,
        timestamp=timestamp,
    )
    payload = {
        "wallet": record.wallet,
        "action": record.action,
        "identity_tag": record.identity_tag,
        "ledger_reference": record.ledger_reference,
        "loyalty_streak": record.loyalty_streak,
        "ghostkey_confirmed": record.ghostkey_confirmed,
        "behavior_multiplier": record.behavior_multiplier,
        "unlock_path": record.unlock_path,
    }
    print(json.dumps(payload, indent=2))


def _cmd_scan(args: argparse.Namespace) -> None:
    _, _, _, behavior, anchor, scanner, _ = _build_runtime()
    since = _parse_timestamp(args.since)
    rewards = scanner.scan(wallet=args.wallet, since=since, limit=args.limit)
    output = []
    for reward in rewards:
        output.append(
            {
                "wallet": reward.wallet,
                "epoch_index": reward.epoch_index,
                "amount": reward.amount,
                "actions": list(reward.actions),
                "loyalty_streak": reward.loyalty_streak,
                "multiplier": reward.multiplier,
                "ghostkey_confirmed": reward.ghostkey_confirmed,
                "ledger_references": list(reward.ledger_references),
                "unlock_path": reward.unlock_path,
            }
        )
    print(json.dumps(output, indent=2))


def _cmd_drop(args: argparse.Namespace) -> None:
    _, _, _, _, _, _, dropper = _build_runtime()
    if args.process:
        results = dropper.process_due()
        payload = [
            {
                "stream_id": result.stream_id,
                "wallet": result.wallet,
                "amount": result.amount,
                "released_at": result.released_at.isoformat(),
                "ledger_reference": result.ledger_reference,
                "test_mode": result.test_mode,
            }
            for result in results
        ]
        print(json.dumps(payload, indent=2))
        return
    if args.simulate:
        result = dropper.simulate_unlock(args.simulate)
        payload = {
            "stream_id": result.stream_id,
            "wallet": result.wallet,
            "amount": result.amount,
            "released_at": result.released_at.isoformat(),
            "ledger_reference": result.ledger_reference,
            "test_mode": result.test_mode,
        }
        print(json.dumps(payload, indent=2))
        return
    if args.pause:
        dropper.pause(args.pause, reason=args.reason)
        print(json.dumps({"status": "paused", "stream_id": args.pause}))
        return
    if args.resume:
        dropper.resume(args.resume)
        print(json.dumps({"status": "resumed", "stream_id": args.resume}))
        return
    if args.override:
        unlock_at = _parse_timestamp(args.override_unlock)
        amount = args.override_amount
        dropper.override(args.override, unlock_at=unlock_at, amount=amount)
        payload = {"status": "overridden", "stream_id": args.override}
        if unlock_at:
            payload["unlock_at"] = unlock_at.isoformat()
        if amount is not None:
            payload["amount"] = amount
        print(json.dumps(payload, indent=2))
        return
    if not args.wallet or args.amount is None or args.epoch_index is None:
        raise SystemExit("wallet, amount, and epoch_index are required when scheduling drops")
    unlock_at = _parse_timestamp(args.unlock_at)
    if unlock_at is None:
        unlock_at = datetime.now(timezone.utc) + timedelta(minutes=args.unlock_minutes)
    drop = dropper.schedule(
        args.wallet,
        args.amount,
        unlock_at=unlock_at,
        epoch_index=args.epoch_index,
        actions=args.action,
        metadata={},
        test_mode=args.test_mode,
    )
    payload = {
        "stream_id": drop.stream_id,
        "wallet": drop.wallet,
        "amount": drop.amount,
        "unlock_at": drop.unlock_at.isoformat(),
        "epoch_index": drop.epoch_index,
        "test_mode": drop.test_mode,
    }
    print(json.dumps(payload, indent=2))


def _cmd_multiplier(args: argparse.Namespace) -> None:
    config, _, _, behavior, _, _, _ = _build_runtime()
    snapshot = behavior.try_snapshot(args.wallet)
    if snapshot is None:
        streak = args.preview_streak
        multiplier = config.behavior_multiplier(streak)
        payload = {
            "wallet": args.wallet,
            "registered": False,
            "preview_streak": streak,
            "multiplier": multiplier,
        }
    else:
        payload = {
            "wallet": snapshot.wallet,
            "registered": True,
            "loyalty_streak": snapshot.loyalty_streak,
            "ghostkey_confirmed": snapshot.ghostkey_confirmed,
            "behavior_multiplier": snapshot.behavior_multiplier,
            "unlock_path": snapshot.unlock_path,
        }
    print(json.dumps(payload, indent=2))


def register(subparsers: argparse._SubParsersAction) -> None:
    p_yield = subparsers.add_parser("tools:yield", help="Record a RetroYield action")
    p_yield.add_argument("wallet", help="Wallet claiming the action")
    p_yield.add_argument("action", help="Belief action identifier")
    p_yield.add_argument("--tag", action="append", help="Optional belief tags")
    p_yield.add_argument("--weight", type=float, default=1.0, help="Action weight")
    p_yield.add_argument("--timestamp", help="ISO timestamp override")
    p_yield.set_defaults(func=_cmd_yield)

    p_scan = subparsers.add_parser("tools:scan", help="Audit retro rewards")
    p_scan.add_argument("--wallet", help="Optional wallet filter")
    p_scan.add_argument("--since", help="Only include records after timestamp")
    p_scan.add_argument("--limit", type=int, help="Maximum number of actions to process")
    p_scan.set_defaults(func=_cmd_scan)

    p_drop = subparsers.add_parser("tools:drop", help="Manage RetroYield drops")
    p_drop.add_argument("--wallet", help="Wallet for scheduling")
    p_drop.add_argument("--amount", type=float, help="Amount to schedule")
    p_drop.add_argument("--epoch-index", type=int, dest="epoch_index", help="Epoch index for the drop")
    p_drop.add_argument("--action", action="append", help="Actions contributing to the drop")
    p_drop.add_argument("--unlock-at", dest="unlock_at", help="Unlock timestamp (ISO)")
    p_drop.add_argument(
        "--unlock-minutes",
        type=int,
        default=60,
        help="Unlock offset in minutes when timestamp not provided",
    )
    p_drop.add_argument("--test-mode", action="store_true", help="Schedule in test mode")
    p_drop.add_argument("--process", action="store_true", help="Process due drops")
    p_drop.add_argument("--simulate", help="Stream id to simulate")
    p_drop.add_argument("--pause", help="Stream id to pause")
    p_drop.add_argument("--resume", help="Stream id to resume")
    p_drop.add_argument("--reason", help="Optional reason for pause")
    p_drop.add_argument("--override", help="Stream id to override")
    p_drop.add_argument("--override-unlock", help="Override unlock timestamp")
    p_drop.add_argument("--override-amount", type=float, help="Override amount")
    p_drop.set_defaults(func=_cmd_drop)

    p_multiplier = subparsers.add_parser("tools:multiplier", help="Preview vault multipliers")
    p_multiplier.add_argument("wallet", help="Wallet to inspect")
    p_multiplier.add_argument(
        "--preview-streak",
        type=int,
        default=0,
        help="Preview streak when wallet is not registered",
    )
    p_multiplier.set_defaults(func=_cmd_multiplier)
