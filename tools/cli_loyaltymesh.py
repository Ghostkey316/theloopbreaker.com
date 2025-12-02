"""CLI for interacting with the Vaultfire LoyaltyMesh v1.0."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Sequence

from vaultfire.loyalty_engine import LoyaltyEngine
from vaultfire.loyalty_snapshot import LoyaltySnapshotter


def parse_recall_history(raw: str | None) -> Sequence[float]:
    if not raw:
        return []
    values: list[float] = []
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            values.append(float(part))
        except ValueError:
            continue
    return values


def command_live(args: argparse.Namespace) -> None:
    engine = LoyaltyEngine()
    recall_history = parse_recall_history(args.recall_history)
    result = engine.calculate_multiplier(
        args.validator,
        pop_tier=args.pop_tier,
        belief_sync_streak=args.streak,
        recall_precision=args.recall_precision,
        recall_history=recall_history,
    )
    yield_class = engine.classify_yield_class(result.net_multiplier)
    payload = {
        "validator_id": result.validator_id,
        "pop_tier": result.pop_tier,
        "belief_sync_streak": result.belief_sync_streak,
        "recall_precision": result.recall_precision,
        "base_multiplier": result.base_multiplier,
        "streak_amplifier": result.streak_amplifier,
        "recall_penalty": result.recall_penalty,
        "net_multiplier": result.net_multiplier,
        "yield_class": yield_class,
        "timestamp": result.timestamp.isoformat(),
    }
    print(json.dumps(payload, indent=2, sort_keys=True))


def command_snapshot(args: argparse.Namespace) -> None:
    engine = LoyaltyEngine()
    snapshotter = LoyaltySnapshotter(engine, snapshot_path=args.snapshot_path)
    recall_history = parse_recall_history(args.recall_history)
    snapshot = snapshotter.capture(
        args.validator,
        pop_tier=args.pop_tier,
        belief_sync_streak=args.streak,
        recall_history=recall_history,
        missed_windows=args.missed_windows,
    )
    print(json.dumps(snapshot.asdict(), indent=2, sort_keys=True))


def command_projections(args: argparse.Namespace) -> None:
    engine = LoyaltyEngine()
    snapshotter = LoyaltySnapshotter(engine, snapshot_path=args.snapshot_path)
    history = snapshotter.history()
    projections = snapshotter.project_yield_classes(history)
    response = {
        "snapshot_count": len(history),
        "yield_classes": projections,
    }
    print(json.dumps(response, indent=2, sort_keys=True))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subcommands = parser.add_subparsers(dest="command", required=True)

    live = subcommands.add_parser("live", help="Display live multiplier state for a validator")
    live.add_argument("validator", help="Validator identifier")
    live.add_argument("--pop-tier", type=int, default=0, dest="pop_tier")
    live.add_argument("--streak", type=int, default=0, help="BeliefSync streak days")
    live.add_argument("--recall-precision", type=float, default=None)
    live.add_argument("--recall-history", type=str, default=None, help="Comma-separated recall precision history")
    live.set_defaults(func=command_live)

    snapshot = subcommands.add_parser("snapshot", help="Trigger manual LoyaltyMesh snapshot")
    snapshot.add_argument("validator", help="Validator identifier")
    snapshot.add_argument("--pop-tier", type=int, default=0, dest="pop_tier")
    snapshot.add_argument("--streak", type=int, default=0, help="BeliefSync streak days")
    snapshot.add_argument("--missed-windows", type=int, default=0, dest="missed_windows")
    snapshot.add_argument("--recall-history", type=str, default=None, help="Comma-separated recall precision history")
    snapshot.add_argument(
        "--snapshot-path",
        type=str,
        default="loyalty_snapshots.json",
        dest="snapshot_path",
        help="Location to write snapshot rollups",
    )
    snapshot.set_defaults(func=command_snapshot)

    projections = subcommands.add_parser("projections", help="View yield class projections and history")
    projections.add_argument(
        "--snapshot-path",
        type=str,
        default="loyalty_snapshots.json",
        dest="snapshot_path",
        help="Snapshot history source",
    )
    projections.set_defaults(func=command_projections)

    return parser


def main(argv: Sequence[str] | None = None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
