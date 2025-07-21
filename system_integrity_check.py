import json
from pathlib import Path

from engine.identity_resolver import resolve_identity
from engine.loyalty_engine import update_loyalty_ranks

BASE_DIR = Path(__file__).resolve().parent
ETHICS_PATH = BASE_DIR / "ethics" / "core.mdx"
CONFIG_PATH = BASE_DIR / "vaultfire-core" / "vaultfire_config.json"
SNAPSHOT_PATH = BASE_DIR / "dashboards" / "contributor_snapshot.json"
BINDINGS_PATH = BASE_DIR / "dashboards" / "contributor_bindings.json"
USER_LIST_PATH = BASE_DIR / "user_list.json"
SCORECARD_PATH = BASE_DIR / "user_scorecard.json"


def _load_json(path: Path, default):
    if path.exists():
        try:
            with open(path) as f:
                return json.load(f)
        except json.JSONDecodeError:
            return default
    return default


def check_ethics() -> list[str]:
    errors = []
    if not ETHICS_PATH.exists() or ETHICS_PATH.stat().st_size == 0:
        errors.append("ethics core file missing or empty")
    cfg = _load_json(CONFIG_PATH, {})
    if not cfg.get("ethics_anchor", False):
        errors.append("ethics_anchor disabled in config")
    return errors


def check_loyalty_engine() -> list[str]:
    errors = []
    scorecard = _load_json(SCORECARD_PATH, None)
    if scorecard is None:
        errors.append("user_scorecard.json missing or invalid")
    try:
        update_loyalty_ranks()
    except Exception as e:
        errors.append(f"loyalty_engine failure: {e}")
    return errors


def check_snapshot() -> list[str]:
    errors = []
    data = _load_json(SNAPSHOT_PATH, None)
    if data is None:
        errors.append("contributor snapshot missing or invalid")
    return errors


def check_contributor_bindings() -> list[str]:
    errors = []
    user_ids = _load_json(USER_LIST_PATH, None)
    if user_ids is None:
        errors.append("user_list.json missing or invalid")
        user_ids = []
    bindings = _load_json(BINDINGS_PATH, {})
    for user in user_ids:
        entry = bindings.get(user)
        if not entry:
            errors.append(f"no binding for user {user}")
            continue
        if "contributor_xp" not in entry:
            errors.append(f"xp missing for {user}")
        if "loyalty_multiplier" not in entry:
            errors.append(f"multiplier missing for {user}")
    return errors


def run_integrity_check() -> dict:
    return {
        "ethics": check_ethics(),
        "loyalty_engine": check_loyalty_engine(),
        "snapshot": check_snapshot(),
        "contributor_bindings": check_contributor_bindings(),
    }


if __name__ == "__main__":
    result = run_integrity_check()
    print(json.dumps(result, indent=2))
    issues = [msg for msgs in result.values() for msg in msgs]
    if issues:
        print("Integrity check issues detected:")
        for category, msgs in result.items():
            for msg in msgs:
                print(f"- {category}: {msg}")
    else:
        print("All systems operational")
