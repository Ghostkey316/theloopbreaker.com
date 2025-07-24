from __future__ import annotations
from typing import Dict

try:
    import assemblyai  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    assemblyai = None  # type: ignore


def transcribe_audio(path: str) -> Dict:
    """Return transcription for ``path`` using AssemblyAI if available."""
    if assemblyai is None:
        return {"text": "", "provider": "fallback"}
    client = assemblyai.Client()
    with open(path, "rb") as f:
        transcript = client.transcribe(f)
    return {"text": getattr(transcript, "text", ""), "provider": "assemblyai"}


__all__ = ["transcribe_audio"]
