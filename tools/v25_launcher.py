"""Vaultfire v25 launch helper."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.append(str(BASE_DIR))

from system_integrity_check import run_integrity_check


def load_config(path: Path) -> dict:
    try:
        with open(path) as f:
            return json.load(f)
    except Exception as exc:
        raise ValueError(f"invalid config: {exc}")


def write_fork(config: dict) -> Path:
    fork_cfg = config.get("fork", {})
    if not fork_cfg.get("generate"):
        return Path()
    file_name = fork_cfg.get("file", "vaultfire_fork_v25.json")
    path = Path(file_name)
    path.write_text(json.dumps(config, indent=2))
    return path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Vaultfire v25 launcher")
    parser.add_argument("config", help="Path to config JSON")
    args = parser.parse_args(argv)

    cfg = load_config(Path(args.config))

    if cfg.get("diagnostics"):
        result = run_integrity_check()
        print(json.dumps(result, indent=2))

    fork_path = write_fork(cfg)
    if fork_path:
        print(f"fork written to {fork_path}")

    markers = cfg.get("finalMarkers", {})
    if markers:
        print("final markers:")
        for k, v in markers.items():
            print(f"- {k}: {v}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
