import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
SCORECARD_PATH = BASE_DIR / "user_scorecard.json"
REPO_LOG_PATH = BASE_DIR / "logs" / "repo_activity_log.json"
UPGRADE_LOG_PATH = BASE_DIR / "logs" / "system_upgrade_log.json"
SCORES_PATH = BASE_DIR / "dashboards" / "contributor_scores.json"


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


def _activity_counts(log):
    counts = {}
    for entry in log:
        uid = entry.get("user_id")
        if not uid:
            continue
        counts[uid] = counts.get(uid, 0) + 1
    return counts


TAG_THRESHOLDS = [
    (900, "OG Architect"),
    (700, "Verified Believer"),
    (400, "System Builder"),
]


def contributor_score(user_id: str) -> tuple[int, str]:
    scorecard = _load_json(SCORECARD_PATH, {})
    repo_log = _load_json(REPO_LOG_PATH, [])
    upgrade_log = _load_json(UPGRADE_LOG_PATH, [])

    repo_counts = _activity_counts(repo_log)
    upgrade_counts = _activity_counts(upgrade_log)

    user = scorecard.get(user_id, {})
    alignment = user.get("alignment_score", 0)
    loyalty = user.get("loyalty", 0)
    trust = user.get("trust_behavior", 0)
    repo = repo_counts.get(user_id, 0)
    upgrades = upgrade_counts.get(user_id, 0)

    score = alignment * 3 + loyalty * 2 + trust + repo * 5 + upgrades * 10
    score = int(max(0, min(score, 1000)))

    tag = "Echo Agent"
    for threshold, name in TAG_THRESHOLDS:
        if score >= threshold:
            tag = name
            break
    return score, tag


def update_contributor_scores() -> dict:
    scorecard = _load_json(SCORECARD_PATH, {})
    repo_log = _load_json(REPO_LOG_PATH, [])
    upgrade_log = _load_json(UPGRADE_LOG_PATH, [])

    user_ids = set(scorecard.keys())
    user_ids.update(entry.get("user_id") for entry in repo_log)
    user_ids.update(entry.get("user_id") for entry in upgrade_log)

    scores = {}
    for uid in filter(None, user_ids):
        score, tag = contributor_score(uid)
        scores[uid] = {"score": score, "tag": tag}
        info = scorecard.get(uid, {})
        info["contributor_score"] = score
        info["contributor_tag"] = tag
        scorecard[uid] = info

    _write_json(SCORES_PATH, scores)
    _write_json(SCORECARD_PATH, scorecard)
    return scores


if __name__ == "__main__":
    result = update_contributor_scores()
    print(json.dumps(result, indent=2))
