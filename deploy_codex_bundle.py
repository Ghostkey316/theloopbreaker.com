from __future__ import annotations

import json
from pathlib import Path
import zipfile

BASE_DIR = Path(__file__).resolve().parent
OUTPUT_PATH = BASE_DIR / "vaultfire_codex_bundle_v1.zip"


def gather_files() -> list[Path]:
    files = [BASE_DIR / "partner_auto_onboard.py"]
    files.extend(sorted(BASE_DIR.glob("vaultfire_*.json")))
    return [f for f in files if f.exists()]


def build_bundle(output: Path, files: list[Path]) -> None:
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in files:
            zf.write(path, path.name)


def main() -> int:
    files = gather_files()
    build_bundle(OUTPUT_PATH, files)
    manifest = {"bundle": OUTPUT_PATH.name, "files": [f.name for f in files]}
    print(json.dumps(manifest, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
