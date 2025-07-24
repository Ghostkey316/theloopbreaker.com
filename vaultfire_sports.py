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
from urllib.request import urlopen
from datetime import datetime
from uuid import uuid4

from engine import record_belief_action

# Data files
REGISTRY_PATH = Path("sports_registry.json")
CRED_LOG_PATH = Path("fan_cred_log.csv")
RIVALRY_PATH = Path("rivalry_matrix.json")
NFT_MAP_PATH = Path("sports_nft_map.json")
ATHLETE_NODE_PATH = Path("athlete_node_log.json")
TEAM_MAP_PATH = Path("team_fan_map.json")
CHECKIN_LOG_PATH = Path("event_checkin_log.csv")
MEMORY_LOG_PATH = Path("fan_story_log.json")
BATTLE_LOG_PATH = Path("fan_battle_log.csv")
LOYALTY_TRACKER_PATH = Path("loyalty_bond_tracker.json")


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


def _sync_schedule(team: str, fallback: str | None = None) -> Dict:
    """Return schedule data for ``team`` from ESPN API or fallback file."""
    url = (
        "https://site.api.espn.com/apis/v2/sports/football/college-football/"
        f"teams/{team}/schedule"
    )
    try:
        with urlopen(url, timeout=5) as resp:
            return json.load(resp)
    except Exception:
        if fallback:
            return _load_json(Path(fallback), {})
    return {}


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


def cmd_set_team(args: argparse.Namespace) -> None:
    """Track favorite team and sync schedule."""
    team_map: Dict[str, List[str]] = _load_json(TEAM_MAP_PATH, {})
    fans = team_map.get(args.team, [])
    if args.identity not in fans:
        fans.append(args.identity)
    team_map[args.team] = fans
    _write_json(TEAM_MAP_PATH, team_map)

    schedule = _sync_schedule(args.team, args.fallback)
    for event in schedule.get("events", []):
        comp = event.get("competitions", [{}])[0]
        status = comp.get("status", {}).get("type", {}).get("description", "")
        prompt = f"{args.team} {status}"
        record_belief_action(args.identity, args.identity, prompt)
    print(f"Favorite team set: {args.team}")


def cmd_check_in(args: argparse.Namespace) -> None:
    """Log event check-in with optional GPS tag."""
    row = [datetime.utcnow().isoformat(), args.identity, args.team or "", args.gps or ""]
    exists = CHECKIN_LOG_PATH.exists()
    with open(CHECKIN_LOG_PATH, "a", newline="") as f:
        writer = csv.writer(f)
        if not exists:
            writer.writerow(["timestamp", "identity", "team", "gps"])
        writer.writerow(row)
    print("Check-in recorded")


def cmd_memory(args: argparse.Namespace) -> None:
    """Capture a fan memory for the chain."""
    memory = input("Share your memory: ").strip()
    if not memory:
        print("No memory entered")
        return
    log: List[Dict[str, Any]] = _load_json(MEMORY_LOG_PATH, [])
    log.append({
        "timestamp": datetime.utcnow().isoformat(),
        "identity": args.identity,
        "team": args.team,
        "memory": memory,
    })
    _write_json(MEMORY_LOG_PATH, log)
    record_belief_action(args.identity, args.identity, memory)
    print("Memory saved")


def cmd_battle(args: argparse.Namespace) -> None:
    """Start a fan battle prediction."""
    result = args.result or ""
    if not result and args.resolve:
        schedule = _sync_schedule(args.team, None)
        result = schedule.get("status", "") if isinstance(schedule, dict) else ""
    row = [
        datetime.utcnow().isoformat(),
        args.identity,
        args.rival,
        args.prediction,
        args.stakes,
        result,
    ]
    exists = BATTLE_LOG_PATH.exists()
    with open(BATTLE_LOG_PATH, "a", newline="") as f:
        writer = csv.writer(f)
        if not exists:
            writer.writerow(["timestamp", "identity", "rival", "prediction", "stakes", "result"])
        writer.writerow(row)
    if result:
        record_belief_action(args.identity, args.identity, result)
    print("Battle logged")


def cmd_challenge(args: argparse.Namespace) -> None:
    """Manage long-term prediction challenges."""
    tracker: List[Dict[str, Any]] = _load_json(LOYALTY_TRACKER_PATH, [])
    if args.accept:
        for entry in tracker:
            if entry.get("id") == args.accept and args.identity not in entry.get("accepted_by", []):
                entry.setdefault("accepted_by", []).append(args.identity)
        _write_json(LOYALTY_TRACKER_PATH, tracker)
        print("Challenge accepted")
        return

    entry = {
        "id": str(uuid4()),
        "identity": args.identity,
        "team": args.team,
        "description": args.description,
        "due": args.due,
        "accepted_by": [],
    }
    tracker.append(entry)
    _write_json(LOYALTY_TRACKER_PATH, tracker)
    print("Challenge created")


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

    p_set_team = sub.add_parser("set-team", help="Set favorite team")
    p_set_team.add_argument("identity")
    p_set_team.add_argument("team")
    p_set_team.add_argument("--fallback")
    p_set_team.set_defaults(func=cmd_set_team)

    p_checkin = sub.add_parser("check-in", help="Event check-in")
    p_checkin.add_argument("identity")
    p_checkin.add_argument("--team")
    p_checkin.add_argument("--gps")
    p_checkin.set_defaults(func=cmd_check_in)

    p_memory = sub.add_parser("memory", help="Log a fan memory")
    p_memory.add_argument("identity")
    p_memory.add_argument("--team", default="")
    p_memory.set_defaults(func=cmd_memory)

    p_battle = sub.add_parser("battle", help="Start fan battle")
    p_battle.add_argument("identity")
    p_battle.add_argument("team")
    p_battle.add_argument("rival")
    p_battle.add_argument("prediction")
    p_battle.add_argument("stakes")
    p_battle.add_argument("--resolve", action="store_true")
    p_battle.add_argument("--result")
    p_battle.set_defaults(func=cmd_battle)

    p_challenge = sub.add_parser("challenge", help="Long term challenge")
    p_challenge.add_argument("identity")
    p_challenge.add_argument("team")
    p_challenge.add_argument("description")
    p_challenge.add_argument("--due", default="")
    p_challenge.add_argument("--accept")
    p_challenge.set_defaults(func=cmd_challenge)

    args = parser.parse_args(argv)
    args.func(args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
