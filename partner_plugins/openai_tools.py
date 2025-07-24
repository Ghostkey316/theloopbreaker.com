from __future__ import annotations
from typing import Dict

try:
    import openai  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    openai = None  # type: ignore


def summarize_text(text: str) -> Dict:
    """Return a short summary of ``text`` using OpenAI if available."""
    if openai is None:
        return {"summary": text[:100], "provider": "fallback"}
    resp = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[{"role": "user", "content": text}],
        max_tokens=60,
    )
    summary = resp["choices"][0]["message"]["content"]
    return {"summary": summary, "provider": "openai"}


__all__ = ["summarize_text"]
