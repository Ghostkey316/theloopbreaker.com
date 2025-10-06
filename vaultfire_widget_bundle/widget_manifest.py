"""Widget manifest helpers for Ghostkey Vaultfire Agent Builder."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Mapping, MutableMapping, Optional

from . import load_widget_config

__all__ = ["WidgetBundle", "load"]


@dataclass
class WidgetBundle:
    """Lightweight wrapper around the widget manifest JSON."""

    manifest: Mapping[str, object]
    mode: str

    def export(self, *, include_ui_toggles: bool = False) -> Mapping[str, object]:
        manifest_dict = dict(self.manifest)
        payload: MutableMapping[str, object] = {
            "mode": self.mode,
            "manifest": manifest_dict,
        }
        profile = manifest_dict.get(self.mode)
        if isinstance(profile, Mapping):
            payload["profile"] = dict(profile)
        if include_ui_toggles:
            ui_config = manifest_dict.get("ui")
            toggles = []
            if isinstance(ui_config, Mapping):
                raw_toggles = ui_config.get("toggles", [])
                if isinstance(raw_toggles, Mapping):
                    toggles = list(raw_toggles.values())
                else:
                    toggles = list(raw_toggles) if isinstance(raw_toggles, (list, tuple)) else []
            payload["ui_toggles"] = toggles
        return payload


def load(*, mode: str = "preview", base_path: Optional[Path] = None) -> WidgetBundle:
    """Load the widget manifest with the requested ``mode`` profile."""

    manifest = load_widget_config(base_path)
    return WidgetBundle(manifest=manifest, mode=mode)

