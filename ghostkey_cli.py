"""Ghostkey CLI extensions for signal echo and fork inspection."""

from __future__ import annotations

import argparse
import json
from importlib import import_module
from typing import Any

from vaultfire.protocol.signal_echo import SignalEchoEngine
from vaultfire.protocol.timeflare import TimeFlare
from vaultfire.quantum.hashmirror import QuantumHashMirror

_yield_module = import_module("vaultfire.yield")
PulseSync = getattr(_yield_module, "PulseSync")
TemporalGiftMatrixEngine = getattr(_yield_module, "TemporalGiftMatrixEngine")


def _load_echo_engine(path: str | None) -> SignalEchoEngine:
    if path is None:
        return SignalEchoEngine.load()
    return SignalEchoEngine.load(path)


def _parse_wallet_spec(spec: str) -> dict[str, object] | str:
    parts = spec.split(":")
    wallet = parts[0]
    if len(parts) == 1:
        return wallet
    profile: dict[str, object] = {"wallet": wallet}
    if len(parts) >= 2 and parts[1]:
        profile["belief_multiplier"] = float(parts[1])
    if len(parts) >= 3 and parts[2]:
        profile["trajectory_bonus"] = float(parts[2])
    return profile


def cmd_echoindex(args: argparse.Namespace) -> None:
    engine = _load_echo_engine(args.source)
    frames = engine.replay(args.interaction) if args.interaction else engine.frames()
    if args.limit is not None and args.limit >= 0:
        frames = frames[-args.limit :]
    payload: dict[str, Any] = {
        "interaction": args.interaction,
        "count": len(frames),
        "weight": engine.signal_weight(args.interaction),
        "frames": [frame.to_payload() for frame in frames],
    }
    print(json.dumps(payload, indent=2))


def cmd_forkview(args: argparse.Namespace) -> None:
    ledger_path = args.ledger
    timeflare = TimeFlare(ledger_path=ledger_path) if ledger_path else TimeFlare()
    entries = timeflare.load()
    if args.interaction:
        entries = [item for item in entries if item.get("interaction_id") == args.interaction]
    if args.limit is not None and args.limit >= 0:
        entries = entries[-args.limit :]
    payload = {"count": len(entries), "forks": entries}
    print(json.dumps(payload, indent=2))


def cmd_yieldclaim(args: argparse.Namespace) -> None:
    if not args.wallet:
        raise SystemExit("At least one --wallet argument is required")

    signal_engine = _load_echo_engine(args.echo_index)
    timeflare = TimeFlare(ledger_path=args.ledger) if args.ledger else TimeFlare()
    pulse_sync = PulseSync()
    hash_mirror = QuantumHashMirror(seed=args.mirror_seed or "ghostkey-cli")
    engine = TemporalGiftMatrixEngine(
        timeflare=timeflare,
        signal_engine=signal_engine,
        pulse_sync=pulse_sync,
        hash_mirror=hash_mirror,
        base_reward=args.base,
    )

    recipients = [_parse_wallet_spec(entry) for entry in args.wallet]
    record = engine.generate_matrix(args.interaction, recipients)
    payload = {
        "record_id": record.record_id,
        "interaction_id": record.interaction_id,
        "created_at": record.created_at.isoformat(),
        "metadata": dict(record.metadata),
        "allocations": [
            {
                "wallet": allocation.wallet,
                "allocation": allocation.allocation,
                "belief_score": allocation.belief_score,
                "signal_weight": allocation.signal_weight,
                "timeline_branch": allocation.timeline_branch,
                "priority": allocation.priority,
                "identity_tag": allocation.identity_tag,
            }
            for allocation in record.allocations
        ],
    }
    print(json.dumps(payload, indent=2))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="ghostkey", description="Ghostkey protocol tooling")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_echo = sub.add_parser("echoindex", help="Inspect the signal echo index")
    p_echo.add_argument("--interaction", help="Filter by interaction id", default=None)
    p_echo.add_argument("--limit", type=int, default=None, help="Limit number of frames returned")
    p_echo.add_argument("--source", help="Optional path to a serialized index", default=None)
    p_echo.set_defaults(func=cmd_echoindex)

    p_fork = sub.add_parser("forkview", help="Inspect MoralForkEngine outcomes")
    p_fork.add_argument("--interaction", help="Filter by interaction id", default=None)
    p_fork.add_argument("--limit", type=int, default=None, help="Limit number of fork entries")
    p_fork.add_argument("--ledger", help="Optional path to a ledger file", default=None)
    p_fork.set_defaults(func=cmd_forkview)

    p_yield = sub.add_parser("yieldclaim", help="Generate Temporal Gift Matrix allocations")
    p_yield.add_argument("--interaction", required=True, help="Interaction id to evaluate")
    p_yield.add_argument(
        "--wallet",
        action="append",
        help="Recipient wallet (optionally wallet:belief_multiplier:trajectory_bonus)",
        required=True,
    )
    p_yield.add_argument("--ledger", help="Optional path to a TimeFlare ledger", default=None)
    p_yield.add_argument("--echo-index", help="Optional path to a signal echo index", default=None)
    p_yield.add_argument("--base", type=float, default=100.0, help="Base reward used for allocations")
    p_yield.add_argument(
        "--mirror-seed",
        default=None,
        help="Optional seed for deterministic QuantumHashMirror tags",
    )
    p_yield.set_defaults(func=cmd_yieldclaim)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
