"""CLI entrypoint for the Vaultfire PoP Engine."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Mapping

from vaultfire.pop_engine import PoPEngine


def _load_payload(path: Path) -> Mapping[str, object]:
    data = json.loads(path.read_text())
    if not isinstance(data, dict):
        raise ValueError("Vaultproof payload must be a JSON object")
    return data


def _render_history(history: Mapping[str, list[Mapping[str, object]]]) -> str:
    if not history:
        return "No PoP history recorded yet."
    lines: list[str] = []
    for validator_id, entries in history.items():
        lines.append(f"Validator {validator_id}:")
        for entry in entries:
            lines.append(
                "  - "
                + f"{entry.get('timestamp')} | score={float(entry.get('score', 0.0)):.2f} "
                + f"tier={entry.get('tier')} "
                + f"vaultloop={entry.get('vaultloop_hash', '')}"
            )
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Vaultfire Proof-of-Pattern engine")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--calculate", metavar="VAULTPROOF_FILE", help="Calculate PoP score from a payload file")
    group.add_argument("--tier-check", dest="tier_check", metavar="VALIDATOR_ID", help="Check the latest tier for a validator")
    group.add_argument("--history", action="store_true", help="Show cached PoP history")
    parser.add_argument("--json", action="store_true", help="Render history in JSON form")
    parser.add_argument("--cache", default="pop_cache.json", help="Path to PoP cache file")
    args = parser.parse_args()

    engine = PoPEngine(cache_path=args.cache)

    if args.calculate:
        payload_path = Path(args.calculate)
        data = _load_payload(payload_path)
        result = engine.calculate_score(
            str(data.get("validator_id")),
            vaultproofs=data.get("vaultproofs", []),
            recall_strength=float(data.get("recall_strength", 0.0)),
            amplifier_streak=int(data.get("amplifier_streak", 0)),
            vaultloop_hash=str(data.get("vaultloop_hash", payload_path.stem)),
        )
        print(json.dumps(result.asdict(), indent=2))
        return

    if args.tier_check:
        latest = engine.latest(args.tier_check)
        if not latest:
            print(f"No tier history found for validator {args.tier_check}")
            return
        print(
            f"Validator {args.tier_check} is Tier {latest['tier']} with score "
            f"{float(latest.get('score', 0.0)):.2f} (updated {latest.get('timestamp')})."
        )
        return

    history = engine.history()
    if args.json:
        print(json.dumps(history, indent=2, sort_keys=True))
    else:
        print(_render_history(history))


if __name__ == "__main__":
    main()
