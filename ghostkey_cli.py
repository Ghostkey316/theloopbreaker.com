"""Ghostkey CLI extensions for signal echo and fork inspection."""

from __future__ import annotations

import argparse
import json
from importlib import import_module
from pathlib import Path
from typing import Any, Iterable, Mapping

from vaultfire.protocol.signal_echo import SignalEchoEngine
from vaultfire.protocol.timeflare import TimeFlare
from vaultfire.quantum.hashmirror import QuantumHashMirror
from vaultfire.modules.ethic_resonant_time_engine import EthicResonantTimeEngine
from vaultfire.modules.vaultfire_protocol_stack import GiftMatrixV1, VaultfireProtocolStack

_yield_module = import_module("vaultfire.yield")
PulseSync = getattr(_yield_module, "PulseSync")
TemporalGiftMatrixEngine = getattr(_yield_module, "TemporalGiftMatrixEngine")

IDENTITY_HANDLE = "bpow20.cb.id"
IDENTITY_ENS = "ghostkey316.eth"


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


def _load_actions(path: str | None) -> list[Mapping[str, object]]:
    if path is None:
        return []
    data = json.loads(Path(path).read_text())
    if isinstance(data, list):
        return [dict(item) for item in data if isinstance(item, Mapping)]
    return []


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


def cmd_timecheck(args: argparse.Namespace) -> None:
    actions = _load_actions(args.actions)
    engine = EthicResonantTimeEngine(
        args.user,
        identity_handle=IDENTITY_HANDLE,
        identity_ens=IDENTITY_ENS,
    )
    for action in actions:
        engine.register_action(action)
    payload = engine.timecheck()
    print(json.dumps(payload, indent=2))


def cmd_pulse(args: argparse.Namespace) -> None:
    actions = _load_actions(args.actions)
    engine = EthicResonantTimeEngine(
        args.user,
        identity_handle=IDENTITY_HANDLE,
        identity_ens=IDENTITY_ENS,
    )
    for action in actions:
        engine.register_action(action)
    payload = engine.pulse()
    print(json.dumps(payload, indent=2))


def _prepare_gift_matrix(
    *,
    actions: Iterable[Mapping[str, object]],
    interaction: str | None,
    purity: float,
    branch: str,
    priority: str,
    ethic_score: float,
    alignment_bias: float,
    wallets: Iterable[str | Mapping[str, object]],
) -> GiftMatrixV1:
    stack = VaultfireProtocolStack(actions=tuple(actions))
    matrix = stack.gift_matrix
    if interaction:
        matrix.record_signal(interaction, belief_purity=purity, tags=("cli", "vaultfire"))
        matrix.register_fork(
            interaction,
            branch=branch,
            priority=priority,
            ethic_score=ethic_score,
            alignment_bias=alignment_bias,
        )
        matrix.claim(interaction, wallets)
    return matrix


def cmd_unlocknext(args: argparse.Namespace) -> None:
    actions = _load_actions(args.actions)
    stack = VaultfireProtocolStack(actions=tuple(actions))
    payload = stack.unlock_next(args.label)
    print(json.dumps(payload, indent=2))


def cmd_pulsewatch(args: argparse.Namespace) -> None:
    actions = _load_actions(args.actions)
    recipients: list[str | Mapping[str, object]] = []
    if args.wallet:
        recipients = [_parse_wallet_spec(entry) for entry in args.wallet]
    elif args.interaction:
        recipients = [IDENTITY_ENS]
    matrix = _prepare_gift_matrix(
        actions=actions,
        interaction=args.interaction,
        purity=args.purity,
        branch=args.branch,
        priority=args.priority,
        ethic_score=args.ethic_score,
        alignment_bias=args.alignment_bias,
        wallets=recipients,
    )
    stack = VaultfireProtocolStack(actions=tuple(actions))
    stack.gift_matrix = matrix
    payload = stack.pulsewatch()
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

    p_time = sub.add_parser("timecheck", help="Inspect temporal ethics diagnostics")
    p_time.add_argument("--actions", help="Optional path to ledger actions", default=None)
    p_time.add_argument("--user", default="ghostkey-316", help="Override the user identifier")
    p_time.set_defaults(func=cmd_timecheck)

    p_pulse = sub.add_parser("pulse", help="Inspect the latest quantum pulse")
    p_pulse.add_argument("--actions", help="Optional path to ledger actions", default=None)
    p_pulse.add_argument("--user", default="ghostkey-316", help="Override the user identifier")
    p_pulse.set_defaults(func=cmd_pulse)

    p_unlock = sub.add_parser("unlocknext", help="Advance the GiftMatrix protocol layer")
    p_unlock.add_argument("--label", help="Optional label for the new layer", default=None)
    p_unlock.add_argument("--actions", help="Optional path to ledger actions", default=None)
    p_unlock.set_defaults(func=cmd_unlocknext)

    p_watch = sub.add_parser("pulsewatch", help="Render live pulse and yield insights")
    p_watch.add_argument("--actions", help="Optional path to ledger actions", default=None)
    p_watch.add_argument("--interaction", help="Interaction id to seed GiftMatrix", default=None)
    p_watch.add_argument("--purity", type=float, default=0.85, help="Belief purity score")
    p_watch.add_argument("--branch", default="stable", help="Timeline branch label")
    p_watch.add_argument("--priority", default="low", help="Timeline priority label")
    p_watch.add_argument("--ethic-score", dest="ethic_score", type=float, default=0.75)
    p_watch.add_argument("--alignment-bias", dest="alignment_bias", type=float, default=0.2)
    p_watch.add_argument(
        "--wallet",
        action="append",
        default=None,
        help="Recipient wallet (optionally wallet:belief_multiplier:trajectory_bonus)",
    )
    p_watch.set_defaults(func=cmd_pulsewatch)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
