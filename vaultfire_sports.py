"""Playmaker Loop - Vaultfire Sports CLI

This module integrates college football fan features into the Vaultfire protocol.
Attribution: Ghostkey-316 is the system originator.
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any, Dict, List

# Data files
REGISTRY_PATH = Path("sports_registry.json")
CRED_LOG_PATH = Path("fan_cred_log.csv")
RIVALRY_PATH = Path("rivalry_matrix.json")
NFT_MAP_PATH = Path("sports_nft_map.json")
ATHLETE_NODE_PATH = Path("athlete_node_log.json")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _load_json(path: Path, default: Any) -> Any:
    if path.exists():
        try:
            with open(path) as f:
                return json.load(f)
        except json.JSONDecodeError:
            return default
    return default


def _write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def _append_csv(path: Path, row: List[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    exists = path.exists()
    with open(path, "a", newline="") as f:
        writer = csv.writer(f)
        if not exists:
            writer.writerow(["timestamp", "identity", "action", "value", "detail"])
        writer.writerow(row)


# ---------------------------------------------------------------------------
# Fan Cred Score Engine
# ---------------------------------------------------------------------------


def add_cred(identity: str, action: str, value: int, detail: str) -> None:
    from datetime import datetime

    _append_csv(
        CRED_LOG_PATH,
        [datetime.utcnow().isoformat(), identity, action, str(value), detail],
    )


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------


def cmd_init(args: argparse.Namespace) -> None:
    """Register fan identity."""
    registry: Dict[str, Dict[str, Any]] = _load_json(REGISTRY_PATH, {})
    identity = args.identity
    registry[identity] = {
        "team": args.team,
        "loyalty": args.loyalty,
        "nft_badge": args.nft_badge,
    }
    _write_json(REGISTRY_PATH, registry)
    print(f"Registered {identity} for {args.team} with loyalty {args.loyalty}")



def cmd_predict(args: argparse.Namespace) -> None:
    """Log game prediction."""
    detail = f"{args.team} vs {args.opponent} winner: {args.winner}"
    add_cred(args.identity, "prediction", 10, detail)
    print("Prediction logged")



def cmd_rival(args: argparse.Namespace) -> None:
    """Register rivalry interaction."""
    matrix: Dict[str, Dict[str, int]] = _load_json(RIVALRY_PATH, {})
    team = args.team
    rival = args.rival
    matrix.setdefault(team, {})
    matrix[team][rival] = matrix[team].get(rival, 0) + 1
    _write_json(RIVALRY_PATH, matrix)
    add_cred(args.identity, "rivalry", 5, f"{team} vs {rival}")
    print("Rival interaction recorded")



def cmd_quiz(args: argparse.Namespace) -> None:
    """Run trivia quiz from a local JSON question set."""
    questions: List[Dict[str, Any]] = _load_json(Path(args.file), [])
    if not questions:
        print("No questions found")
        return
    score = 0
    for q in questions:
        print(q.get("question"))
        ans = input("Your answer: ").strip().lower()
        if ans == str(q.get("answer", "")).lower():
            score += 1
    add_cred(args.identity, "quiz", score * 2, f"score {score} / {len(questions)}")
    print(f"Quiz complete. Score: {score}/{len(questions)}")



def cmd_earn(args: argparse.Namespace) -> None:
    """Display total fan cred."""
    if not CRED_LOG_PATH.exists():
        print("No cred log found")
        return
    total = 0
    with open(CRED_LOG_PATH) as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("identity") == args.identity:
                total += int(row.get("value", 0))
    print(f"Total Fan Cred for {args.identity}: {total}")



def cmd_forge(args: argparse.Namespace) -> None:
    """Placeholder for NFT creation from predictions."""
    add_cred(args.identity, "forge", 15, "forged prediction NFT")
    print("Forge complete - NFT logic pending")



def cmd_update(args: argparse.Namespace) -> None:
    """Sync new game data (placeholder)."""
    add_cred(args.identity, "update", 2, "game data synced")
    print("Game data synced")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="vaultfire_sports", description="Playmaker Loop - Vaultfire Sports")
    sub = parser.add_subparsers(dest="command", required=True)

    p_init = sub.add_parser("init", help="Initialize fan identity")
    p_init.add_argument("identity", help="ENS name or wallet")
    p_init.add_argument("--team", required=True, help="Favorite team")
    p_init.add_argument("--loyalty", default="Tier 1")
    p_init.add_argument("--nft-badge")
    p_init.set_defaults(func=cmd_init)

    p_predict = sub.add_parser("predict", help="Log game prediction")
    p_predict.add_argument("identity")
    p_predict.add_argument("team")
    p_predict.add_argument("opponent")
    p_predict.add_argument("winner")
    p_predict.set_defaults(func=cmd_predict)

    p_rival = sub.add_parser("rival", help="Register rival interaction")
    p_rival.add_argument("identity")
    p_rival.add_argument("team")
    p_rival.add_argument("rival")
    p_rival.set_defaults(func=cmd_rival)

    p_quiz = sub.add_parser("quiz", help="Run trivia quiz")
    p_quiz.add_argument("identity")
    p_quiz.add_argument("file", help="Path to question set JSON")
    p_quiz.set_defaults(func=cmd_quiz)

    p_earn = sub.add_parser("earn", help="Display fan cred")
    p_earn.add_argument("identity")
    p_earn.set_defaults(func=cmd_earn)

    p_forge = sub.add_parser("forge", help="Forge NFT from prediction")
    p_forge.add_argument("identity")
    p_forge.set_defaults(func=cmd_forge)

    p_update = sub.add_parser("update", help="Sync game data")
    p_update.add_argument("identity")
    p_update.set_defaults(func=cmd_update)

    args = parser.parse_args(argv)
    args.func(args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
