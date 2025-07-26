"""GeoLock v1 filtering utilities."""
from __future__ import annotations

from pathlib import Path


def strip_exif(data: bytes, blur_faces: bool = False) -> bytes:
    """Remove simple GPS markers from ``data``."""
    return data.replace(b"GPS", b"")


def sanitize_file(path: Path, blur_faces: bool = False) -> bytes:
    data = path.read_bytes()
    sanitized = strip_exif(data, blur_faces)
    path.write_bytes(sanitized)
    return sanitized


def has_gps_exif(data: bytes) -> bool:
    return b"GPS" in data

__all__ = ["strip_exif", "sanitize_file", "has_gps_exif"]
