#!/usr/bin/env python3
"""Fanforge CLI - Vaultfire Sports Extension

Attribution: Ghostkey-316

This CLI provides sandboxed college football fan interactions built on the
Vaultfire Protocol. It integrates belief actions with the loyalty engine.
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any, Dict, List
from uuid import uuid4
from datetime import datetime

# Core modules
try:
    import vaultfire_core  # type: ignore  # noqa:F401
except Exception:  # pragma: no cover - optional core
    vaultfire_core = None

from vaultfire_fork_v2 import encrypt_data  # type: ignore
from engine.proof_of_loyalty import record_belief_action
from engine.loyalty_engine import loyalty_enhanced_score


TEAM_MAP_PATH = Path("team_fan_map.json")
CHECKIN_LOG_PATH = Path("event_checkin_log.csv")
MEMORY_LOG_PATH = Path("fan_story_log.json")
BATTLE_LOG_PATH = Path("fan_battle_log.csv")
LOYALTY_TRACKER_PATH = Path("loyalty_bond_tracker.json")
SCHOLARSHIP_PATH = Path("loyalty_scholarship_registry.json")
PULSE_LOG_PATH = Path("crowd_pulse_log.csv")
SHOUTCAST_LOG_PATH = Path("fan_shoutcast_log.json")
CLIP_LOG_PATH = Path("vaultfire_clip_registry.json")
NFT_MAP_PATH = Path("sports_nft_map.json")
ATHLETE_NODE_PATH = Path("athlete_node_log.json")

SANDBOX = False
TESTMODE = False


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
    if SANDBOX or TESTMODE:
        print(f"[sandbox] would write {path}")
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


def _append_csv(path: Path, row: List[str], header: List[str]) -> None:
    if SANDBOX or TESTMODE:
        print(f"[sandbox] would append to {path}: {row}")
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    exists = path.exists()
    with open(path, "a", newline="") as f:
        writer = csv.writer(f)
        if not exists:
            writer.writerow(header)
        writer.writerow(row)


def _sync_schedule(team: str, fallback: str | None = None) -> Dict:
    url = (
        "https://site.api.espn.com/apis/v2/sports/football/college-football/" f"teams/{team}/schedule"
    )
    if SANDBOX:
        return _load_json(Path(fallback) if fallback else Path(""), {})
    try:
        from urllib.request import urlopen

        with urlopen(url, timeout=5) as resp:
            return json.load(resp)
    except Exception:
        if fallback:
            return _load_json(Path(fallback), {})
    return {}


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

def cmd_set_team(args: argparse.Namespace) -> None:
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

    print(f"Favorite team set for {args.identity}: {args.team}")


def cmd_check_in(args: argparse.Namespace) -> None:
    row = [datetime.utcnow().isoformat(), args.identity, args.team or "", args.gps or ""]
    _append_csv(CHECKIN_LOG_PATH, row, ["timestamp", "identity", "team", "gps"])
    print("Check-in recorded")


def cmd_memory(args: argparse.Namespace) -> None:
    memory = input("Share your memory: ").strip()
    if not memory:
        print("No memory entered")
        return
    log: List[Dict[str, Any]] = _load_json(MEMORY_LOG_PATH, [])
    entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "identity": args.identity,
        "team": args.team,
        "memory": memory,
    }
    log.append(entry)
    _write_json(MEMORY_LOG_PATH, log)
    record_belief_action(args.identity, args.identity, memory)
    print("Memory saved")


def cmd_battle(args: argparse.Namespace) -> None:
    result = args.result or ""
    row = [
        datetime.utcnow().isoformat(),
        args.identity,
        args.rival,
        args.prediction,
        args.stakes,
        result,
    ]
    _append_csv(
        BATTLE_LOG_PATH,
        row,
        ["timestamp", "identity", "rival", "prediction", "stakes", "result"],
    )
    if result:
        record_belief_action(args.identity, args.identity, result)
    print("Battle logged")


def cmd_challenge(args: argparse.Namespace) -> None:
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


def cmd_scholarship(args: argparse.Namespace) -> None:
    registry: List[Dict[str, Any]] = _load_json(SCHOLARSHIP_PATH, [])
    token = encrypt_data(args.identity.encode(), "ghostkey")
    entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "identity": args.identity,
        "token": token,
    }
    registry.append(entry)
    _write_json(SCHOLARSHIP_PATH, registry)
    print("Scholarship token granted")


def cmd_pulse(args: argparse.Namespace) -> None:
    pulse = "".join(args.emojis)
    row = [datetime.utcnow().isoformat(), args.identity, args.team or "", pulse]
    _append_csv(PULSE_LOG_PATH, row, ["timestamp", "identity", "team", "pulse"])
    loyalty_enhanced_score(args.identity, mood=len(pulse))
    print("Crowd pulse recorded")


def cmd_shout(args: argparse.Namespace) -> None:
    message = args.message or input("Shout: ").strip()
    log: List[Dict[str, Any]] = _load_json(SHOUTCAST_LOG_PATH, [])
    entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "identity": args.identity,
        "team": args.team,
        "message": message,
    }
    log.append(entry)
    _write_json(SHOUTCAST_LOG_PATH, log)
    record_belief_action(args.identity, args.identity, message)
    print("Shout recorded")


def cmd_clip(args: argparse.Namespace) -> None:
    log: List[Dict[str, Any]] = _load_json(CLIP_LOG_PATH, [])
    entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "identity": args.identity,
        "team": args.team,
        "link": args.link,
        "sentiment": args.sentiment,
    }
    log.append(entry)
    _write_json(CLIP_LOG_PATH, log)
    print("Clip archived")


def cmd_signal_athlete(args: argparse.Namespace) -> None:
    log: List[Dict[str, Any]] = _load_json(ATHLETE_NODE_PATH, [])
    entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "identity": args.identity,
        "athlete": args.athlete,
        "message": args.message,
    }
    log.append(entry)
    _write_json(ATHLETE_NODE_PATH, log)
    print("Athlete signal sent")


def cmd_nft_mode(args: argparse.Namespace) -> None:
    nft_map: Dict[str, Any] = _load_json(NFT_MAP_PATH, {})
    nft_map[args.identity] = {
        "token": args.token,
        "upgrades": args.upgrades,
    }
    _write_json(NFT_MAP_PATH, nft_map)
    print("NFT mode updated")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main(argv: List[str] | None = None) -> int:
    global SANDBOX, TESTMODE

    parser = argparse.ArgumentParser(prog="fanforge", description="Vaultfire Fanforge CLI")
    parser.add_argument("--sandbox", action="store_true", help="Run without writing files")
    parser.add_argument("--testmode", action="store_true", help="Enable test behavior")
    parser.add_argument("--activate-gridiron-mode", action="store_true")
    parser.add_argument("--worldcoin-layer", action="store_true")
    sub = parser.add_subparsers(dest="command", required=True)

    p_team = sub.add_parser("set-team", help="Track favorite team")
    p_team.add_argument("identity")
    p_team.add_argument("team")
    p_team.add_argument("--fallback")
    p_team.set_defaults(func=cmd_set_team)

    p_check = sub.add_parser("check-in", help="Event check-in")
    p_check.add_argument("identity")
    p_check.add_argument("--team")
    p_check.add_argument("--gps")
    p_check.set_defaults(func=cmd_check_in)

    p_mem = sub.add_parser("memory", help="Log fan memory")
    p_mem.add_argument("identity")
    p_mem.add_argument("--team", default="")
    p_mem.set_defaults(func=cmd_memory)

    p_battle = sub.add_parser("battle", help="Fan battle prediction")
    p_battle.add_argument("identity")
    p_battle.add_argument("rival")
    p_battle.add_argument("prediction")
    p_battle.add_argument("stakes")
    p_battle.add_argument("--result")
    p_battle.set_defaults(func=cmd_battle)

    p_chal = sub.add_parser("challenge", help="Season challenge")
    p_chal.add_argument("identity")
    p_chal.add_argument("team")
    p_chal.add_argument("description")
    p_chal.add_argument("--due", default="")
    p_chal.add_argument("--accept")
    p_chal.set_defaults(func=cmd_challenge)

    p_sch = sub.add_parser("scholarship", help="Grant loyalty scholarship")
    p_sch.add_argument("identity")
    p_sch.set_defaults(func=cmd_scholarship)

    p_pulse = sub.add_parser("pulse", help="Crowd energy sync")
    p_pulse.add_argument("identity")
    p_pulse.add_argument("--team", default="")
    p_pulse.add_argument("emojis", nargs="+")
    p_pulse.set_defaults(func=cmd_pulse)

    p_shout = sub.add_parser("shout", help="Live shoutcast mode")
    p_shout.add_argument("identity")
    p_shout.add_argument("--team", default="")
    p_shout.add_argument("--message")
    p_shout.set_defaults(func=cmd_shout)

    p_clip = sub.add_parser("clip", help="Archive clip link")
    p_clip.add_argument("identity")
    p_clip.add_argument("team")
    p_clip.add_argument("link")
    p_clip.add_argument("--sentiment", default="")
    p_clip.set_defaults(func=cmd_clip)

    p_signal = sub.add_parser("signal-athlete", help="Send athlete message")
    p_signal.add_argument("identity")
    p_signal.add_argument("athlete")
    p_signal.add_argument("message")
    p_signal.set_defaults(func=cmd_signal_athlete)

    p_nft = sub.add_parser("nft-mode", help="NFT gated access")
    p_nft.add_argument("identity")
    p_nft.add_argument("token")
    p_nft.add_argument("--upgrades", default="")
    p_nft.set_defaults(func=cmd_nft_mode)

    args = parser.parse_args(argv)
    SANDBOX = args.sandbox
    TESTMODE = args.testmode

    args.func(args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
