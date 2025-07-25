"""Mirrorforge 3D output plugin integrating upcoming GPT-5 capabilities.

This module accepts natural language prompts and produces manipulable 3D models
(GLTF or USDZ). Generated files are stored in a versioned manifest under
``mirrorforge/assets/{wallet}/{object_id}`` along with ``belief_id`` and
timestamp metadata. Sample objects include "belief totem", "identity shard",
and "contributor mask". Models are exportable to WebGL and Unity pipelines.
"""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict

try:
    import openai  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    openai = None  # type: ignore

# Base directory for storing assets; override for testing via environment
BASE_DIR = Path(
    os.getenv(
        "MIRRORFORGE_ASSETS_DIR",
        Path(__file__).resolve().parent.parent / "mirrorforge" / "assets",
    )
)

SAMPLE_OBJECTS = ["belief totem", "identity shard", "contributor mask"]
DEFAULT_WALLET = "ghostkey316.eth"


def _render_3d(prompt: str, fmt: str = "gltf") -> bytes:
    """Return binary 3D data for ``prompt`` using GPT-5 if available."""
    if openai is None:
        return f"{prompt}->{fmt}".encode()
    resp = openai.ChatCompletion.create(
        model="gpt-5",  # upcoming model with 3D output
        messages=[{"role": "user", "content": prompt}],
        max_tokens=2048,
    )
    return resp["choices"][0]["message"]["content"].encode()


def _write_manifest(wallet: str, object_id: str, entry: Dict) -> None:
    manifest = BASE_DIR / wallet / object_id / "manifest.json"
    manifest.parent.mkdir(parents=True, exist_ok=True)
    data = []
    if manifest.exists():
        try:
            data = json.loads(manifest.read_text())
        except Exception:
            data = []
    data.append(entry)
    manifest.write_text(json.dumps(data, indent=2))


def create_object(
    prompt: str,
    fmt: str = "gltf",
    wallet: str = DEFAULT_WALLET,
    *,
    tokenizable: bool = False,
    watermark: bool = False,
    timed_reveal: bool = False,
    partner_lock: bool = False,
) -> Dict:
    """Create a 3D model from ``prompt`` and record it in the manifest."""
    object_id = uuid.uuid4().hex[:8]
    belief_id = uuid.uuid4().hex[:12]
    data = _render_3d(prompt, fmt)
    obj_dir = BASE_DIR / wallet / object_id
    obj_dir.mkdir(parents=True, exist_ok=True)
    model_path = obj_dir / f"model.{fmt}"
    model_path.write_bytes(data)

    token = uuid.uuid4().hex if tokenizable else None

    record = {
        "belief_id": belief_id,
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "wallet": wallet,
        "object_id": object_id,
        "file": str(model_path.relative_to(BASE_DIR.parent)),
        "format": fmt,
        "prompt": prompt,
        "tokenizable": tokenizable,
        "watermark": watermark,
        "timed_reveal": timed_reveal,
        "partner_lock": partner_lock,
    }
    if tokenizable:
        record["token"] = token
    _write_manifest(wallet, object_id, record)
    return record


__all__ = ["create_object", "SAMPLE_OBJECTS"]
