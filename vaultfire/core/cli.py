"""Ghostkey CLI orchestration utilities."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, Iterable, List, Mapping, MutableMapping, Sequence

__all__ = ["GhostkeyCLI"]


def _now_ts() -> str:
    return datetime.now(timezone.utc).isoformat()


class GhostkeyCLI:
    """Registry for Ghostkey CLI subcommands and capabilities."""

    _subcommands: MutableMapping[str, set[str]] = {}
    _last_updated: str | None = None

    @classmethod
    def add_subcommands(cls, descriptors: Iterable[str]) -> Mapping[str, object]:
        for descriptor in descriptors:
            if descriptor is None:
                continue
            text = str(descriptor).strip()
            if not text:
                continue
            head, *rest = text.split(maxsplit=1)
            category = head.lower()
            remainder = rest[0] if rest else ""
            if "/" in remainder:
                actions = [segment.strip() for segment in remainder.split("/") if segment.strip()]
            elif remainder:
                actions = [remainder.strip()]
            else:
                actions = [""]
            bucket = cls._subcommands.setdefault(category, set())
            for action in actions:
                bucket.add(action)
        cls._last_updated = _now_ts()
        return cls.manifest()

    @classmethod
    def manifest(cls) -> Mapping[str, object]:
        categories: Dict[str, Sequence[str]] = {}
        commands: List[str] = []
        for category, actions in cls._subcommands.items():
            sorted_actions = sorted(actions)
            categories[category] = sorted_actions
            for action in sorted_actions:
                command = f"{category} {action}".strip()
                commands.append(command)
        commands.sort()
        return {
            "commands": commands,
            "categories": categories,
            "updated_at": cls._last_updated,
            "count": len(commands),
        }

    @classmethod
    def reset(cls) -> None:
        cls._subcommands.clear()
        cls._last_updated = None

