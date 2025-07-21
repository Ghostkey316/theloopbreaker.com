import json
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
CORE_PATH = BASE_DIR / "ethics" / "core.mdx"
LOG_PATH = BASE_DIR / "vaultfire-core" / "ethics" / "pr_merge_log.json"


def _ethics_version():
    """Return the version string from the first header line of core.mdx."""
    if not CORE_PATH.exists():
        return "unknown"
    with open(CORE_PATH) as f:
        first = f.readline().strip()
    # Expecting '# Ghostkey Ethics Framework v1.0'
    if "v" in first:
        return first.split("v")[-1]
    return "unknown"


def log_pr_merge():
    """Append timestamp and ethics version to the PR merge log."""
    version = _ethics_version()
    entry = {
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "ethics_version": version,
    }
    log = []
    if LOG_PATH.exists():
        try:
            with open(LOG_PATH) as f:
                log = json.load(f)
        except json.JSONDecodeError:
            log = []
    log.append(entry)
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(LOG_PATH, "w") as f:
        json.dump(log, f, indent=2)
    print(entry)


if __name__ == "__main__":
    log_pr_merge()
