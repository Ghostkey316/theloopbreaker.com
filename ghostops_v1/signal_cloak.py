from __future__ import annotations

import base64
import codecs
import hashlib
from dataclasses import dataclass
from typing import Dict


@dataclass
class SignalCloakConfig:
    """Configuration for the Signal Cloak System."""

    mode: str = "passive"  # passive == stealth, active == full encode
    keyword_salt: str = "ghostkey-316"

    def __post_init__(self) -> None:
        if self.mode not in {"passive", "active"}:
            raise ValueError("mode must be 'passive' or 'active'")
        if not self.keyword_salt:
            raise ValueError("keyword_salt must be provided")


class SignalCloakSystem:
    """Prompt obfuscation layer with pattern scrambling and self-encryption."""

    def __init__(self, config: SignalCloakConfig | None = None):
        self.config = config or SignalCloakConfig()

    @staticmethod
    def _pairwise_scramble(text: str) -> str:
        """Swap adjacent characters to create a reversible scramble pattern."""

        chars = list(text)
        for index in range(0, len(chars) - 1, 2):
            chars[index], chars[index + 1] = chars[index + 1], chars[index]
        return "".join(chars)

    def _encrypt_payload(self, scrambled: str) -> str:
        salted = f"{self.config.keyword_salt}:{scrambled}"
        rot = codecs.encode(salted, "rot_13")
        return base64.urlsafe_b64encode(rot.encode()).decode()

    def _decrypt_payload(self, encoded: str) -> str:
        decoded = base64.urlsafe_b64decode(encoded.encode()).decode()
        rot_clean = codecs.decode(decoded, "rot_13")
        prefix = f"{self.config.keyword_salt}:"
        if not rot_clean.startswith(prefix):
            raise ValueError("encoded payload missing expected keyword salt")
        return rot_clean[len(prefix) :]

    def obfuscate(self, message: str) -> Dict[str, str]:
        scrambled = self._pairwise_scramble(message)
        fingerprint = hashlib.sha256(scrambled.encode()).hexdigest()
        if self.config.mode == "active":
            encoded = self._encrypt_payload(scrambled)
            return {
                "mode": "active",
                "encoded": encoded,
                "fingerprint": fingerprint,
            }
        return {
            "mode": "passive",
            "scrambled": scrambled,
            "fingerprint": fingerprint,
        }

    def reveal(self, payload: Dict[str, str]) -> str:
        mode = payload.get("mode", "passive")
        if mode == "active":
            scrambled = self._decrypt_payload(payload["encoded"])
        else:
            scrambled = payload["scrambled"]
        return self._pairwise_scramble(scrambled)

    def with_mode(self, mode: str) -> "SignalCloakSystem":
        return SignalCloakSystem(SignalCloakConfig(mode=mode, keyword_salt=self.config.keyword_salt))
