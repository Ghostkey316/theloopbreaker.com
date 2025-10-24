"""Noir plugin registry for Vaultfire Codex integrations."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence

__all__ = ["NoirPlugin", "discover_plugins"]


@dataclass(slots=True)
class NoirPlugin:
    """Metadata about a Noir applet."""

    name: str
    path: Path

    def source(self) -> str:
        return self.path.read_text(encoding="utf-8")

    def validate(self) -> None:
        text = self.source()
        if "fn main" not in text:
            raise ValueError(f"Noir plugin {self.name} is missing an entry point")
        if "constrain" not in text:
            raise ValueError(f"Noir plugin {self.name} lacks constraints")


def discover_plugins(directory: Path | None = None) -> Sequence[NoirPlugin]:
    folder = directory or Path(__file__).resolve().parent
    plugins: list[NoirPlugin] = []
    for file_path in folder.glob("*.nr"):
        plugins.append(NoirPlugin(name=file_path.stem, path=file_path))
    return plugins
