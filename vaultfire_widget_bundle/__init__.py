"""Bundle packaging for the Ghostkey Vaultfire Agent Builder widget.

This module exposes helper factories used by OpenAI's Agent Builder to
wire the widget configuration with telemetry streaming utilities and
Mission Control automation hooks.  The bundle is intentionally lightweight
so the files can be uploaded directly to the Agent Builder UI.
"""

from __future__ import annotations

from pathlib import Path
from typing import Dict, Iterable, Iterator, Mapping

from .telemetry.gradient_stream import GradientStreamPacket, GradientStreamer
from .telemetry.mission_hooks import MissionControlHooks
from .mcp.signal_handler import MissionSignalResponder

__all__ = [
    "GradientStreamPacket",
    "GradientStreamer",
    "MissionControlHooks",
    "MissionSignalResponder",
    "load_widget_config",
]


def load_widget_config(base_path: Path | None = None) -> Mapping[str, object]:
    """Return the parsed widget configuration as a mapping.

    Parameters
    ----------
    base_path:
        Optional base directory that contains :mod:`vaultfire_widget.json`.
        When omitted, the file is resolved relative to this module.
    """

    if base_path is None:
        base_path = Path(__file__).parent
    config_path = base_path / "vaultfire_widget.json"
    data = config_path.read_text(encoding="utf-8")
    import json

    return json.loads(data)


def iter_stream_packets(streamer: GradientStreamer) -> Iterable[GradientStreamPacket]:
    """Expose the gradient packets as an iterator for Agent Builder."""

    return streamer.iter_packets()
