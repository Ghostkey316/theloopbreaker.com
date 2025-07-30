"""Shared helpers for reading and writing JSON files."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def load_json(path: Path, default: Any):
    """Return parsed JSON from ``path`` or ``default`` on error."""
    if path.exists():
        try:
            with open(path) as f:
                return json.load(f)
        except json.JSONDecodeError:
            return default
    return default


def write_json(path: Path, data: Any) -> None:
    """Write ``data`` to ``path`` in JSON format."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


__all__ = ["load_json", "write_json"]
