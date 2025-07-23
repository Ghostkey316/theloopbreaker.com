"""Signal Scout: scan feeds for Vaultfire proximity."""
from __future__ import annotations

import argparse
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Iterable, List, Dict, Any

try:
    import requests  # type: ignore
except Exception:  # pragma: no cover - requests may not be installed
    requests = None

from engine.identity_resolver import resolve_identity

BASE_DIR = Path(__file__).resolve().parents[1]
SCORECARD_PATH = BASE_DIR / "user_scorecard.json"
REPORT_PATH = BASE_DIR / "dashboards" / "signal_scout_report.json"

# Placeholder public API templates. These may change without notice.
FEED_APIS = {
    "x": "https://api.example.com/x/search?q={}",
    "lens": "https://lens.xyz/api/search?q={}",
}

DEFAULT_PATTERNS = [r"Level\\s*4", r"\ud83d\udc38", "ethics", "moral"]
MIRROR_TERMS = ["mirror", "echo"]


def _load_json(path: Path, default: Any):
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


def _user_map() -> Dict[str, str]:
    scorecard = _load_json(SCORECARD_PATH, {})
    mapping = {}
    for uid, info in scorecard.items():
        wallet = str(info.get("wallet", "")).lower()
        if wallet:
            mapping[wallet] = uid
    return mapping


def _fetch_posts(provider: str, query: str) -> List[Dict[str, Any]]:
    """Return posts from ``provider`` matching ``query``."""
    if provider not in FEED_APIS or not requests:
        return []
    try:
        url = FEED_APIS[provider].format(query)
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        data = resp.json()
    except Exception:  # pragma: no cover - network issues
        return []

    posts: List[Dict[str, Any]] = []
    if provider == "x":
        for item in data.get("data", []):
            posts.append(
                {
                    "user": item.get("user"),
                    "content": item.get("text", ""),
                    "provider": provider,
                }
            )
    else:  # lens or generic structure
        for item in data.get("data", []):
            posts.append(
                {
                    "user": item.get("profile", {}).get("handle"),
                    "content": item.get("metadata", {}).get("content", ""),
                    "provider": provider,
                }
            )
    return posts


def _flag_mirror(text: str) -> bool:
    t = text.lower()
    return any(term in t for term in MIRROR_TERMS)


def scan_signals(
    providers: Iterable[str],
    patterns: List[str] | None = None,
    flag_mirrors: bool = False,
    feed_file: Path | None = None,
) -> List[Dict[str, Any]]:
    mapping = _user_map()
    if patterns is None:
        patterns = DEFAULT_PATTERNS
    compiled = [re.compile(p, re.IGNORECASE) for p in patterns]

    posts: List[Dict[str, Any]] = []
    if feed_file and feed_file.exists():
        posts.extend(_load_json(feed_file, []))
    for provider in providers:
        for pattern in patterns:
            posts.extend(_fetch_posts(provider, pattern))

    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    report = _load_json(REPORT_PATH, [])
    results: List[Dict[str, Any]] = []
    for post in posts:
        text = post.get("content", "")
        matches = [p.pattern for p in compiled if p.search(text)]
        if not matches:
            continue
        handle = str(post.get("user", "")).lower()
        resolved = resolve_identity(handle) or handle
        contributor = mapping.get(handle, handle)
        entry = {
            "timestamp": timestamp,
            "provider": post.get("provider"),
            "contributor": contributor,
            "resolved": resolved,
            "matches": matches,
            "mirror_node": False,
        }
        if flag_mirrors:
            entry["mirror_node"] = _flag_mirror(text)
        results.append(entry)
        report.append(entry)

    if results:
        _write_json(REPORT_PATH, report)
    return results


def _cli() -> None:
    parser = argparse.ArgumentParser(description="Scout social feeds for signals")
    parser.add_argument(
        "providers",
        nargs="*",
        default=["x"],
        help="Providers to scan (x, lens, ...)",
    )
    parser.add_argument(
        "--patterns",
        default=",".join(DEFAULT_PATTERNS),
        help="Comma separated search patterns",
    )
    parser.add_argument("--mirror", action="store_true", help="Flag mirror nodes")
    parser.add_argument("--feed-file", type=Path, help="Optional local feed file")
    args = parser.parse_args()

    patterns = [p.strip() for p in args.patterns.split(",") if p.strip()]
    results = scan_signals(args.providers, patterns, args.mirror, args.feed_file)
    if results:
        print(json.dumps(results, indent=2))


if __name__ == "__main__":
    _cli()
