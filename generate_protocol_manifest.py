# Reference: ethics/core.mdx
"""Generate protocol status manifest."""

import json
import hashlib
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
ENGINE_DIR = BASE_DIR / "engine"
CONFIG_PATH = BASE_DIR / "vaultfire-core" / "vaultfire_config.json"
ETHICS_PATH = BASE_DIR / "ethics" / "core.mdx"
PARTNERS_PATH = BASE_DIR / "partners.json"
OUTPUT_PATH = BASE_DIR / "dashboards" / "protocol_status.json"


def ethics_checksum() -> str:
    data = ETHICS_PATH.read_bytes()
    return hashlib.sha256(data).hexdigest()


def extract_version() -> str:
    with open(ETHICS_PATH) as f:
        first = f.readline().strip()
    # Expect format like "# Ghostkey Ethics Framework v1.0"
    if "v" in first:
        return first.split("v")[-1]
    return "unknown"


def list_modules() -> list[str]:
    modules = []
    for path in ENGINE_DIR.glob("*.py"):
        if path.stem != "__init__":
            modules.append(path.stem)
    modules.sort()
    return modules


def load_config() -> dict:
    with open(CONFIG_PATH) as f:
        return json.load(f)


def partner_status() -> list[dict]:
    partners = []
    if PARTNERS_PATH.exists():
        try:
            partners = json.loads(PARTNERS_PATH.read_text())
        except json.JSONDecodeError:
            partners = []
    result = []
    for entry in partners:
        result.append({
            "partner_id": entry.get("partner_id"),
            "aligned": bool(entry.get("aligned"))
        })
    return result


def build_manifest() -> dict:
    manifest = {
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "version": extract_version(),
        "modules": list_modules(),
        "ethics_config": load_config(),
        "partners": partner_status(),
        "ethics_checksum": ethics_checksum(),
    }
    return manifest


def main() -> None:
    manifest = build_manifest()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(manifest, f, indent=2)
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
