from __future__ import annotations

import base64
import json
from pathlib import Path

from vaultfire.modules.myth_compression_mode import (
    CODEX_TAGS,
    MythCompressionMode,
)


def test_myth_compression_mode_compresses_events(tmp_path: Path) -> None:
    mode = MythCompressionMode(
        identity_handle="wallet.test",
        identity_ens="ghostkey316.eth",
        ghostkey_id="ghost-test",
        storage_root=tmp_path,
    )
    mode.record_event({"type": "command", "command": "ghostkey pulse", "success": True})
    payload = mode.compress(milestone=True, reason="unit-test")
    assert payload["ghostkey_id"] == "ghost-test"
    assert payload["tokens"], "Expected symbolic tokens to be generated"
    assert payload["codex_tags"] == CODEX_TAGS
    path = tmp_path / "ghost-test"
    files = list(path.glob("*.mcm"))
    assert files, "Expected myth compression file to be written"


def test_myth_compression_export_formats(tmp_path: Path) -> None:
    mode = MythCompressionMode(
        identity_handle="wallet.test",
        identity_ens="ghostkey316.eth",
        ghostkey_id="ghost-export",
        storage_root=tmp_path,
    )
    mode.ensure_bootstrap()
    export_json = mode.export("json")
    assert export_json["format"] == "json"
    json.loads(export_json["content"])
    export_yaml = mode.export("yaml")
    assert "ghostkey_id" in export_yaml["content"]
    export_pdf = mode.export("pdf")
    assert export_pdf["format"] == "pdf"
    base64.b64decode(export_pdf["content"])  # raises if invalid


def test_myth_compression_can_unlock_after_bootstrap(tmp_path: Path) -> None:
    mode = MythCompressionMode(
        identity_handle="wallet.test",
        identity_ens="ghostkey316.eth",
        ghostkey_id="ghost-ready",
        storage_root=tmp_path,
    )
    mode.ensure_bootstrap()
    assert mode.can_unlock() is True
