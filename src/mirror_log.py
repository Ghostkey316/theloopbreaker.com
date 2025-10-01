"""Utilities for managing Humanity Mirror reflection artifacts.

This module centralizes filesystem interactions for the reflection flow so
other components can focus on intelligence and reward logic.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Iterable, Optional, Sequence

DEFAULT_TEMPLATE = """# Humanity Mirror Self-Audit

Use this guided audit to check-in on your actions, intent, and alignment.

- **Moments of integrity:** Describe a choice you are proud of and why it felt aligned.
- **Growth edge:** Call out a moment that deserves repair. What can you do differently?
- **Support request:** Name the help, resources, or accountability you need next.
- **Commitment:** Declare one action you will take in the next 48 hours.
"""


LOG_FILE_NAME = "log_sample.md"
TEMPLATE_FILE_NAME = "self_audit_template.md"
MEMORY_GRAPH_FILE_NAME = "memory_graph.json"
REWARD_STREAM_FILE_NAME = "reward_stream.jsonl"


def _base_dir() -> Path:
    """Resolve the root directory for mirror artifacts."""

    raw_path = os.getenv("VAULTFIRE_MIRROR_DIR")
    if raw_path:
        base_path = Path(raw_path)
    else:
        base_path = Path("mirror_log")
    if not base_path.is_absolute():
        base_path = Path.cwd() / base_path
    return base_path


def ensure_log_environment() -> Path:
    """Ensure that the mirror log directory and seed files exist."""

    base = _base_dir()
    base.mkdir(parents=True, exist_ok=True)

    log_file = base / LOG_FILE_NAME
    if not log_file.exists():
        log_file.write_text("# Humanity Mirror Log\n\n", encoding="utf-8")

    template_file = base / TEMPLATE_FILE_NAME
    if not template_file.exists():
        template_file.write_text(DEFAULT_TEMPLATE, encoding="utf-8")

    graph_file = base / MEMORY_GRAPH_FILE_NAME
    if not graph_file.exists():
        graph_file.write_text(json.dumps({"nodes": [], "edges": []}, indent=2), encoding="utf-8")

    reward_stream_file = base / REWARD_STREAM_FILE_NAME
    if not reward_stream_file.exists():
        reward_stream_file.write_text("", encoding="utf-8")

    return base


def log_file_path() -> Path:
    """Return the path to the primary reflection log file."""

    return ensure_log_environment() / LOG_FILE_NAME


def memory_graph_path() -> Path:
    """Return the path to the structured memory graph."""

    return ensure_log_environment() / MEMORY_GRAPH_FILE_NAME


def reward_stream_path() -> Path:
    """Return the path to the JSONL reward stream ledger."""

    return ensure_log_environment() / REWARD_STREAM_FILE_NAME


def template_path() -> Path:
    """Return the path to the self-audit template."""

    return ensure_log_environment() / TEMPLATE_FILE_NAME


def log_sample(
    entry: str,
    timestamp: str,
    *,
    tags: Optional[Iterable[str]] = None,
    alignment_score: Optional[float] = None,
) -> dict:
    """Append a reflection entry to the markdown log and return its metadata."""

    log_path = log_file_path()
    normalized_tags: Sequence[str] = tuple(sorted({t for t in tags or [] if t}))

    header = f"\n## {timestamp}\n"
    body_lines = [entry.strip()]
    if normalized_tags:
        body_lines.append(f"Tags: {', '.join(normalized_tags)}")
    else:
        body_lines.append("Tags: none")
    if alignment_score is not None:
        body_lines.append(f"Alignment score: {alignment_score:.2f}")
    body = "\n".join(body_lines) + "\n"

    with log_path.open("a", encoding="utf-8") as handle:
        handle.write(header)
        handle.write(body)

    return {
        "timestamp": timestamp,
        "tags": list(normalized_tags),
        "alignment_score": alignment_score,
        "log_path": str(log_path),
    }


def self_audit_template() -> str:
    """Fetch the self-audit template content."""

    return template_path().read_text(encoding="utf-8")


__all__ = [
    "ensure_log_environment",
    "log_sample",
    "self_audit_template",
    "log_file_path",
    "memory_graph_path",
    "reward_stream_path",
    "template_path",
]
