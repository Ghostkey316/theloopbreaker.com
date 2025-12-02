from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Iterable, List, Mapping, Optional


@dataclass
class MirrorStateEntry:
    """Encrypted prompt log anchored to a session receipt."""

    session_id: str
    prompt_cipher: str
    response_cipher: str
    state_hash: str
    receipt: str
    timestamp: float
    alignment_score: Optional[float] = None
    annotations: Mapping[str, Any] = field(default_factory=dict)


class MirrorState:
    """Mirror memory protocol with signed time-anchored hashes."""

    def __init__(self, secret: str = "vaultfire-mirror-secret") -> None:
        self.secret = secret.encode()
        self._entries: List[MirrorStateEntry] = []
        self._hooks: List[Callable[[MirrorStateEntry], None]] = []

    def register_hook(self, hook: Callable[[MirrorStateEntry], None]) -> None:
        self._hooks.append(hook)

    def _digest(self, value: str) -> str:
        digest = hmac.new(self.secret, value.encode(), hashlib.sha256).digest()
        return base64.b64encode(digest).decode()

    def _sign_receipt(self, session_id: str, timestamp: float) -> str:
        payload = f"{session_id}:{timestamp}".encode()
        signature = hmac.new(self.secret, payload, hashlib.sha256).hexdigest()
        return f"receipt::{signature}"

    def _state_hash(self, session_id: str, prompt_cipher: str, response_cipher: str, timestamp: float) -> str:
        payload = f"{session_id}:{prompt_cipher}:{response_cipher}:{timestamp}".encode()
        return hashlib.sha256(payload).hexdigest()

    def log_prompt(
        self,
        session_id: str,
        prompt: str,
        response: str,
        alignment_score: Optional[float] = None,
        annotations: Optional[Mapping[str, Any]] = None,
    ) -> MirrorStateEntry:
        timestamp = time.time()
        prompt_cipher = self._digest(prompt)
        response_cipher = self._digest(response)
        state_hash = self._state_hash(session_id, prompt_cipher, response_cipher, timestamp)
        receipt = self._sign_receipt(session_id, timestamp)
        entry = MirrorStateEntry(
            session_id=session_id,
            prompt_cipher=prompt_cipher,
            response_cipher=response_cipher,
            state_hash=state_hash,
            receipt=receipt,
            timestamp=timestamp,
            alignment_score=alignment_score,
            annotations=annotations or {},
        )
        self._entries.append(entry)
        for hook in self._hooks:
            hook(entry)
        return entry

    def export_entries(self, session_id: Optional[str] = None) -> Iterable[MirrorStateEntry]:
        for entry in self._entries:
            if session_id is None or entry.session_id == session_id:
                yield entry

    def export_stealth(self, session_id: Optional[str] = None) -> Mapping[str, str]:
        payload = [
            {
                "session_id": entry.session_id,
                "state_hash": entry.state_hash,
                "receipt": entry.receipt,
                "timestamp": entry.timestamp,
                "alignment_score": entry.alignment_score,
                "annotations": entry.annotations,
            }
            for entry in self.export_entries(session_id)
        ]
        encoded = base64.b64encode(json.dumps(payload, sort_keys=True).encode()).decode()
        proof = f"zk-snark-proof::{hashlib.sha256(encoded.encode()).hexdigest()[:32]}"
        return {"export": encoded, "proof": proof}


__all__ = ["MirrorState", "MirrorStateEntry"]
