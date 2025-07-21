import json
import hashlib
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_PATH = BASE_DIR / "logs" / "engagement_data.json"
LOG_PATH = BASE_DIR / "logs" / "engagement_log.json"

DEFAULT_METRICS = {
    "likes": 0,
    "shares": 0,
    "scroll_depth": 0.0,
    "read_time": 0.0,
}

WEIGHTS = {
    "likes": 0.5,
    "shares": 1.0,
    "scroll_depth": 0.3,
    "read_time": 0.2,
}


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


def _hash_identifier(identifier: str) -> str:
    return hashlib.sha256(identifier.encode()).hexdigest()


def record_event(identifier: str, event_type: str, value: float = 1.0) -> None:
    """Record a user engagement event."""
    hashed = _hash_identifier(identifier)
    data = _load_json(DATA_PATH, {})
    user = data.get(hashed, DEFAULT_METRICS.copy())
    if event_type in user:
        user[event_type] += value
    data[hashed] = user
    _write_json(DATA_PATH, data)

    log = _load_json(LOG_PATH, [])
    log.append({
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "id": hashed,
        "event": event_type,
        "value": value,
    })
    _write_json(LOG_PATH, log)


def compute_credit(identifier: str) -> float:
    """Return the invisible credit score for ``identifier``."""
    hashed = _hash_identifier(identifier)
    data = _load_json(DATA_PATH, {})
    metrics = data.get(hashed)
    if not metrics:
        return 0.0
    score = 0.0
    for metric, weight in WEIGHTS.items():
        score += metrics.get(metric, 0) * weight
    return score


def reveal_credit(identifier: str) -> dict:
    """Return credit details for ``identifier``."""
    credit = compute_credit(identifier)
    return {"id": _hash_identifier(identifier), "credit": credit}


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Off-chain engagement tracker")
    parser.add_argument("identifier", help="wallet or biometric identifier")
    parser.add_argument("event", nargs="?", help="event type to record")
    parser.add_argument("--value", type=float, default=1.0, help="event value")
    parser.add_argument("--reveal", action="store_true", help="reveal credit")
    args = parser.parse_args()

    if args.event:
        record_event(args.identifier, args.event, args.value)
    if args.reveal:
        info = reveal_credit(args.identifier)
        print(json.dumps(info, indent=2))
