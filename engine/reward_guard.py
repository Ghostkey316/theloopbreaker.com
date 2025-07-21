import json
import re
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
MODULE_DIRS = [BASE_DIR / "engine", BASE_DIR / "vaultfire-core"]
OG_LIST_PATH = BASE_DIR / "og_loyalists.json"
PARTNER_PATH = BASE_DIR / "partners.json"


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


def update_og_loyalists() -> list:
    og = set(_load_json(OG_LIST_PATH, []))
    partners = _load_json(PARTNER_PATH, [])
    changed = False
    for p in partners:
        if p.get("og_loyalist") and p.get("wallet") not in og:
            og.add(p["wallet"])
            changed = True
    if changed:
        _write_json(OG_LIST_PATH, sorted(og))
    return list(og)


def scan_reward_modules() -> list:
    results = []
    pattern = re.compile(r"RETRO_REWARD_PERCENT\s*=\s*([0-9.]+)")
    for directory in MODULE_DIRS:
        for path in directory.rglob("*.py"):
            name = str(path.relative_to(BASE_DIR))
            if "yield" in path.stem or "revenue" in path.stem:
                pct = 0.0
                try:
                    text = path.read_text()
                    m = pattern.search(text)
                    if m:
                        pct = float(m.group(1))
                except OSError:
                    pass
                results.append({"module": name, "pct": pct, "ok": pct >= 0.1})
    return results


if __name__ == "__main__":
    update_og_loyalists()
    print(json.dumps(scan_reward_modules(), indent=2))
