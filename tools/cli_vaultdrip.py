"""CLI tool for manually triggering Vaultdrip Router flows."""

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path

from vaultfire.pop_engine import PoPEngine
from vaultfire.vaultdrip_router import VaultdripRouter


def _seed_previous_tier(engine: PoPEngine, validator_id: str, tier: int) -> None:
    engine._record_history(  # noqa: SLF001 - intentional CLI hook
        validator_id,
        {
            "timestamp": datetime.utcnow().isoformat(),
            "score": 0.0,
            "tier": tier,
            "vaultloop_hash": "cli-seed",
        },
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("validator", help="validator identifier to score and route")
    parser.add_argument(
        "--recall",
        type=float,
        default=0.4,
        help="recall strength value (0-1)",
    )
    parser.add_argument(
        "--streak",
        type=int,
        default=3,
        help="amplifier streak count for PoP scoring",
    )
    parser.add_argument(
        "--vaultloop-hash",
        dest="vaultloop_hash",
        default="cli-vaultloop",
        help="vaultloop hash used for traceability",
    )
    parser.add_argument(
        "--previous-tier",
        type=int,
        default=None,
        help="seed a previous tier to force an upgrade event",
    )
    parser.add_argument(
        "--cache",
        type=Path,
        default=Path("status/pop_vaultdrip_cache.json"),
        help="path to PoP cache for CLI runs",
    )
    return parser


def main(args: list[str] | None = None) -> int:
    parser = build_parser()
    options = parser.parse_args(args=args)

    engine = PoPEngine(cache_path=options.cache)
    router = VaultdripRouter()
    router.attach_to(engine)

    if options.previous_tier is not None:
        _seed_previous_tier(engine, options.validator, options.previous_tier)

    result = engine.calculate_score(
        options.validator,
        recall_strength=options.recall,
        amplifier_streak=options.streak,
        vaultloop_hash=options.vaultloop_hash,
    )

    if result.upgrade_event is None:
        routed = router.route_reward(result)
    else:
        routed = router.routed_events[-1]

    print(json.dumps(routed.asdict(), indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":  # pragma: no cover - CLI entry point
    raise SystemExit(main())
