"""Social layer for forming squads and sharing community ideas."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

BASE_DIR = Path(__file__).resolve().parents[1]
SOCIAL_DIR = BASE_DIR / "logs" / "social"
SQUADS_PATH = SOCIAL_DIR / "squads.json"
IDEAS_PATH = SOCIAL_DIR / "ideas.json"
SIGNALS_PATH = SOCIAL_DIR / "signals.json"
SCORECARD_PATH = BASE_DIR / "user_scorecard.json"
COMPETE_PATH = SOCIAL_DIR / "competitions.json"


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


def _alignment_tier(user_id: str) -> int:
    """Return alignment tier for ``user_id`` based on score."""
    data = _load_json(SCORECARD_PATH, {})
    score = data.get(user_id, {}).get("alignment_score", 0)
    return 1 if score >= 200 else 0


# ---------------------------------------------------------------------------
# Squad management
# ---------------------------------------------------------------------------

def create_squad(squad_id: str, creator: str, metadata: Optional[Dict] = None) -> Dict:
    """Create a new squad and return the record."""
    squads: List[Dict] = _load_json(SQUADS_PATH, [])
    if any(s.get("squad_id") == squad_id for s in squads):
        return {"message": "exists"}
    entry = {
        "squad_id": squad_id,
        "creator": creator,
        "members": [creator],
        "metadata": metadata or {},
        "created": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    squads.append(entry)
    _write_json(SQUADS_PATH, squads)
    return entry


def add_member(squad_id: str, user_id: str) -> bool:
    """Add ``user_id`` to ``squad_id``."""
    squads: List[Dict] = _load_json(SQUADS_PATH, [])
    for squad in squads:
        if squad.get("squad_id") == squad_id:
            if user_id not in squad["members"]:
                squad["members"].append(user_id)
                _write_json(SQUADS_PATH, squads)
                return True
            return False
    return False


def remove_member(squad_id: str, user_id: str) -> bool:
    """Remove ``user_id`` from ``squad_id``."""
    squads: List[Dict] = _load_json(SQUADS_PATH, [])
    for squad in squads:
        if squad.get("squad_id") == squad_id:
            if user_id in squad["members"]:
                squad["members"].remove(user_id)
                _write_json(SQUADS_PATH, squads)
                return True
            return False
    return False


# ---------------------------------------------------------------------------
# Ideas and voting
# ---------------------------------------------------------------------------

def submit_idea(squad_id: str, author: str, text: str) -> Dict:
    """Record a new idea for ``squad_id``."""
    ideas: List[Dict] = _load_json(IDEAS_PATH, [])
    idea_id = f"i{len(ideas) + 1:03d}"
    entry = {
        "id": idea_id,
        "squad": squad_id,
        "author": author,
        "text": text,
        "votes": [],
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    ideas.append(entry)
    _write_json(IDEAS_PATH, ideas)
    return entry


def vote_idea(idea_id: str, voter: str) -> bool:
    """Add ``voter`` to ``idea_id`` if not already voted."""
    ideas: List[Dict] = _load_json(IDEAS_PATH, [])
    for idea in ideas:
        if idea.get("id") == idea_id:
            if voter not in idea["votes"]:
                idea["votes"].append(voter)
                _write_json(IDEAS_PATH, ideas)
                return True
            return False
    return False


# ---------------------------------------------------------------------------
# Signals
# ---------------------------------------------------------------------------

def post_signal(
    sender: str,
    recipient: str,
    intent: str,
    emotion: str,
    belief: str,
    mirror_prompt: Optional[str] = None,
    loop: str = "believe",
) -> Dict:
    """Record a structured signal from ``sender`` to ``recipient``."""
    signals: Dict[str, Dict[str, List[Dict]]] = _load_json(SIGNALS_PATH, {})
    tier = _alignment_tier(sender)
    entry = {
        "from": sender,
        "to": recipient,
        "intent": intent,
        "emotion": emotion,
        "belief": belief,
        "mirror_prompt": mirror_prompt,
        "loop": loop,
        "tier": tier,
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    signals.setdefault(loop, {}).setdefault(f"tier{tier}", []).append(entry)
    _write_json(SIGNALS_PATH, signals)
    return entry


def exchange_signal(sender: str, recipient: str, signal: str) -> Dict:
    """Backward compatible wrapper for plain text signals."""
    return post_signal(sender, recipient, "general", "neutral", signal)


# ---------------------------------------------------------------------------
# Competitions
# ---------------------------------------------------------------------------

def create_competition(comp_id: str, participants: List[str], metadata: Optional[Dict] = None) -> Dict:
    """Create a new competition and return the record."""
    comps: List[Dict] = _load_json(COMPETE_PATH, [])
    if any(c.get("id") == comp_id for c in comps):
        return {"message": "exists"}
    entry = {
        "id": comp_id,
        "participants": participants,
        "metadata": metadata or {},
        "results": {},
        "created": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    comps.append(entry)
    _write_json(COMPETE_PATH, comps)
    return entry


def record_result(comp_id: str, user_id: str, score: float) -> bool:
    """Record ``score`` for ``user_id`` in ``comp_id`` competition."""
    comps: List[Dict] = _load_json(COMPETE_PATH, [])
    for comp in comps:
        if comp.get("id") == comp_id:
            comp.setdefault("results", {})[user_id] = score
            _write_json(COMPETE_PATH, comps)
            return True
    return False


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Vaultfire social layer utilities")
    sub = parser.add_subparsers(dest="cmd")

    p_squad = sub.add_parser("squad")
    p_squad.add_argument("squad_id")
    p_squad.add_argument("creator")

    p_join = sub.add_parser("join")
    p_join.add_argument("squad_id")
    p_join.add_argument("user")

    p_leave = sub.add_parser("leave")
    p_leave.add_argument("squad_id")
    p_leave.add_argument("user")

    p_idea = sub.add_parser("idea")
    p_idea.add_argument("squad_id")
    p_idea.add_argument("author")
    p_idea.add_argument("text")

    p_vote = sub.add_parser("vote")
    p_vote.add_argument("idea_id")
    p_vote.add_argument("voter")

    p_signal = sub.add_parser("signal")
    p_signal.add_argument("sender")
    p_signal.add_argument("recipient")
    p_signal.add_argument("intent")
    p_signal.add_argument("emotion")
    p_signal.add_argument("belief")
    p_signal.add_argument("--mirror")
    p_signal.add_argument("--loop", default="believe")

    p_comp = sub.add_parser("comp")
    p_comp.add_argument("comp_id")
    p_comp.add_argument("participants", nargs="+")
    p_comp.add_argument("--meta")

    p_result = sub.add_parser("result")
    p_result.add_argument("comp_id")
    p_result.add_argument("user")
    p_result.add_argument("score", type=float)

    args = parser.parse_args()
    if args.cmd == "squad":
        print(json.dumps(create_squad(args.squad_id, args.creator), indent=2))
    elif args.cmd == "join":
        add_member(args.squad_id, args.user)
    elif args.cmd == "leave":
        remove_member(args.squad_id, args.user)
    elif args.cmd == "idea":
        print(json.dumps(submit_idea(args.squad_id, args.author, args.text), indent=2))
    elif args.cmd == "vote":
        vote_idea(args.idea_id, args.voter)
    elif args.cmd == "signal":
        print(
            json.dumps(
                post_signal(
                    args.sender,
                    args.recipient,
                    args.intent,
                    args.emotion,
                    args.belief,
                    args.mirror,
                    args.loop,
                ),
                indent=2,
            )
        )
    elif args.cmd == "comp":
        meta = json.loads(args.meta) if args.meta else None
        print(json.dumps(create_competition(args.comp_id, args.participants, meta), indent=2))
    elif args.cmd == "result":
        record_result(args.comp_id, args.user, args.score)
    else:
        parser.print_help()
