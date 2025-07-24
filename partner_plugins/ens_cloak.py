from __future__ import annotations
import json
from pathlib import Path

CONFIG_PATH = Path('ghostfire_config.json')


def toggle_public_display(show: bool) -> None:
    """Show or hide ENS and wallet identifiers."""
    cfg = {}
    if CONFIG_PATH.exists():
        try:
            cfg = json.loads(CONFIG_PATH.read_text())
        except Exception:
            cfg = {}
    cfg['hide_ens'] = not show
    cfg['hide_wallet'] = not show
    CONFIG_PATH.write_text(json.dumps(cfg, indent=2))


__all__ = ["toggle_public_display"]
