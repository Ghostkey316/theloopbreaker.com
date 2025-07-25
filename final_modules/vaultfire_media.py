"""Vaultfire Media v1.0 - simplified placeholder module."""
from __future__ import annotations

import json
import random
import string
from datetime import datetime
from pathlib import Path
from typing import Any, Dict

try:
    from PIL import Image, ImageDraw  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    Image = None  # type: ignore
    ImageDraw = None  # type: ignore

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_MEDIA_DIR = BASE_DIR / "media_cache"
DEFAULT_MEDIA_DIR.mkdir(exist_ok=True)


def _random_id(prefix: str) -> str:
    rand = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"{prefix}{rand}"


def generate_image(prompt: str, wallet: str, out_dir: Path | None = None) -> Dict[str, Any]:
    """Generate a placeholder image and return metadata."""
    out_dir = out_dir or DEFAULT_MEDIA_DIR
    out_dir.mkdir(parents=True, exist_ok=True)
    output_id = _random_id("vaultfire_media_")
    path = out_dir / f"{output_id}.png"
    if Image is not None:
        img = Image.new("RGB", (1024, 1024), color=(73, 109, 137))
        draw = ImageDraw.Draw(img)
        draw.text((10, 10), prompt, fill=(255, 255, 0))
        img.save(path)
    metadata = {
        "wallet": wallet,
        "type": "imagegen",
        "input": prompt,
        "output_id": output_id,
        "render_time": "0s",
        "tags": ["ghost-tier"],
        "loyalty_linked": True,
        "ns3_behavior_id": "default",
        "verified_by": "vaultfire_core",
    }
    with open(out_dir / f"{output_id}.json", "w") as f:
        json.dump(metadata, f, indent=2)
    return metadata


def transcribe_audio(_: str) -> str:
    """Return fake transcription for the demo."""
    return "transcribed speech"


def voice_response(text: str) -> str:
    """Return a simple text response."""
    return f"Voice response to: {text}"


def analyze_video(_: str) -> Dict[str, Any]:
    """Return a dummy video analysis result."""
    return {
        "summary": "video summary",
        "sentiment": "neutral",
        "loyalty_bonus": False,
    }


def build_avatar(wallet: str) -> Dict[str, Any]:
    """Return placeholder avatar details."""
    avatar_id = _random_id("avatar_")
    return {"wallet": wallet, "avatar_id": avatar_id}


__all__ = [
    "generate_image",
    "transcribe_audio",
    "voice_response",
    "analyze_video",
    "build_avatar",
]
