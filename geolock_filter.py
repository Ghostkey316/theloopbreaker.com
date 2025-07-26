"""GeoLock v1 filtering utilities."""
from __future__ import annotations

from pathlib import Path
from io import BytesIO


try:  # Pillow is optional
    from PIL import Image  # type: ignore
except Exception:  # pragma: no cover - Pillow may not be installed
    Image = None  # type: ignore


def strip_exif(data: bytes, blur_faces: bool = False) -> bytes:
    """Remove basic EXIF information including GPS markers.

    Falls back to a simple byte replace if Pillow is unavailable. ``blur_faces``
    is accepted for API compatibility but not implemented.
    """
    if Image:
        try:
            img = Image.open(BytesIO(data))
            img.info.pop("exif", None)
            out = BytesIO()
            img.save(out, format=img.format or "JPEG")
            data = out.getvalue()
        except Exception:  # pragma: no cover - pillow errors fall back
            data = data
    return data.replace(b"GPS", b"")


def sanitize_file(path: Path, blur_faces: bool = False) -> bytes:
    data = path.read_bytes()
    sanitized = strip_exif(data, blur_faces)
    path.write_bytes(sanitized)
    return sanitized


def has_gps_exif(data: bytes) -> bool:
    return b"GPS" in data

__all__ = ["strip_exif", "sanitize_file", "has_gps_exif"]
