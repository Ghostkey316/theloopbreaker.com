"""Compatibility shim for optional partner APIs."""

from __future__ import annotations
import os


class _OpenAI:
    def chat_completion(self, prompt: str) -> dict:
        try:
            if os.getenv("OPENAI_API_KEY") is None:
                raise ValueError("missing key")
            from openai import OpenAI  # type: ignore
            client = OpenAI()
            resp = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=60,
            )
            return resp
        except Exception:
            return {"choices": [{"message": {"content": "unavailable"}}]}


class _NS3:
    def fetch_quiz(self, user_id: str) -> dict:
        try:
            import ns3  # type: ignore
            return ns3.fetch_quiz(user_id)  # type: ignore
        except Exception:
            return {"score": 0, "loyalty_points": 0}


class _Worldcoin:
    def verify(self, user_id: str, world_id: str) -> bool:
        try:
            import worldcoin  # type: ignore
            return bool(worldcoin.verify(user_id, world_id))  # type: ignore
        except Exception:
            return False


openai_api = _OpenAI()
ns3_api = _NS3()
worldcoin_api = _Worldcoin()

__all__ = ["openai_api", "ns3_api", "worldcoin_api"]
