"""Vaultproof snapshot verifier utilities."""

from __future__ import annotations

import base64
import hmac
import json
import hashlib
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Mapping, MutableMapping, Sequence


def _parse_iso(timestamp: str | None) -> datetime | None:
    if not timestamp:
        return None
    try:
        return datetime.fromisoformat(timestamp)
    except ValueError:
        return None


def _parse_epoch(epoch: str | None) -> datetime | None:
    if not epoch:
        return None
    try:
        return datetime.strptime(epoch, "%Y%m%d%H%M%S")
    except ValueError:
        return None


@dataclass(frozen=True)
class VerificationResult:
    """Structured verification output."""

    ok: bool
    reasons: Sequence[str]
    metadata: Mapping[str, Any]
    signature_valid: bool


class VaultproofVerifier:
    """Validate Vaultloop snapshots, echoes, and optional signatures."""

    def __init__(self, *, pulse_window_seconds: int = 900) -> None:
        self.pulse_window = timedelta(seconds=pulse_window_seconds)

    def load_snapshot(self, path: str | Path) -> MutableMapping[str, Any]:
        snapshot_path = Path(path)
        data = json.loads(snapshot_path.read_text())
        if not isinstance(data, MutableMapping):
            raise ValueError("vaultloop snapshot must be a JSON mapping")
        return data

    def _validate_signature(
        self,
        payload: bytes,
        signature_path: Path,
        *,
        key_path: Path | None,
    ) -> tuple[bool, str]:
        if not key_path:
            return False, "signature supplied but no key provided"

        signature_data = json.loads(signature_path.read_text())
        if signature_data.get("format") != ".vaultproof.sig":
            return False, "invalid signature format"

        key = key_path.read_bytes()
        digest = hashlib.sha256(payload).digest()
        expected_signature = hmac.new(key, digest, hashlib.sha256).digest()
        try:
            provided_signature = base64.b64decode(signature_data.get("signature", ""))
        except (TypeError, ValueError):
            return False, "signature is not valid base64"

        if provided_signature != expected_signature:
            return False, "signature mismatch"

        encoded_digest = base64.b64encode(digest).decode()
        if signature_data.get("digest") and signature_data.get("digest") != encoded_digest:
            return False, "digest mismatch"
        return True, ""

    def _latest_echo(self, vaultloop: Mapping[str, Any]) -> Mapping[str, Any]:
        history: Sequence[Mapping[str, Any]] = vaultloop.get("echo_history") or []
        return history[-1] if history else {}

    def _validate_window(
        self,
        *,
        epoch_time: datetime | None,
        drip_time: datetime | None,
        echo_time: datetime | None,
    ) -> str | None:
        if not drip_time:
            return "missing drip timestamp"
        if echo_time and drip_time < echo_time:
            return "drip timestamp precedes latest echo"
        if echo_time and drip_time - echo_time > self.pulse_window:
            return "drip timestamp outside pulse window"
        if epoch_time:
            # epoch_time is derived from the same schedule and should align closely
            delta = abs((drip_time - epoch_time).total_seconds())
            if delta > 1:
                return "drip epoch does not match snapshot epoch"
        return None

    def _audit_snapshot(self, data: Mapping[str, Any]) -> tuple[list[str], Mapping[str, Any]]:
        reasons: list[str] = []
        vaultloop: Mapping[str, Any] = data.get("vaultloop", {})
        loopdrop: Mapping[str, Any] = data.get("loopdrop", {})
        alignment_source: Mapping[str, Any] = loopdrop.get("alignment_source", {}) if isinstance(loopdrop, Mapping) else {}

        latest_echo = self._latest_echo(vaultloop)
        echo_hash = latest_echo.get("belief_hash")
        alignment_hash = alignment_source.get("belief_hash")
        if echo_hash and alignment_hash and echo_hash != alignment_hash:
            reasons.append("loop echo hash mismatch")

        pop_score = vaultloop.get("pop_score")
        echo_pop = latest_echo.get("pop_score")
        if pop_score is not None and echo_pop is not None:
            try:
                if round(float(pop_score), 6) != round(float(echo_pop), 6):
                    reasons.append("PoP score inconsistency detected")
            except (TypeError, ValueError):
                reasons.append("PoP score is not numeric")

        amplifier_boost = vaultloop.get("amplifier_boost") or vaultloop.get("amplifier", {}).get("multiplier")
        echo_amp = latest_echo.get("amplifier_multiplier")
        if amplifier_boost is not None and echo_amp is not None:
            try:
                if round(float(amplifier_boost), 6) != round(float(echo_amp), 6):
                    reasons.append("amplifier multiplier mismatch")
            except (TypeError, ValueError):
                reasons.append("amplifier multiplier is not numeric")

        drip_time = _parse_iso(loopdrop.get("next_drip_epoch"))
        echo_time = _parse_iso(latest_echo.get("timestamp"))
        epoch_time = _parse_epoch(data.get("epoch"))
        window_issue = self._validate_window(epoch_time=epoch_time, drip_time=drip_time, echo_time=echo_time)
        if window_issue:
            reasons.append(window_issue)

        metadata = {
            "persona": data.get("vaultproof", {}).get("payload", {}).get("persona"),
            "soulprint": vaultloop.get("soulprint"),
            "belief_hash": alignment_hash or echo_hash,
            "validator_id": data.get("validator_id") or vaultloop.get("validator_id"),
            "amplifier_tier": vaultloop.get("amplifier_tier"),
            "pop_score": pop_score,
            "drip_epoch": loopdrop.get("next_drip_epoch"),
        }
        return reasons, metadata

    def verify(
        self,
        snapshot_path: str | Path,
        *,
        signature_path: str | Path | None = None,
        key_path: str | Path | None = None,
    ) -> VerificationResult:
        path = Path(snapshot_path)
        payload_bytes = path.read_bytes()
        data = self.load_snapshot(path)

        reasons, metadata = self._audit_snapshot(data)

        signature_valid = True
        if signature_path:
            sig_ok, sig_reason = self._validate_signature(payload_bytes, Path(signature_path), key_path=Path(key_path) if key_path else None)
            signature_valid = sig_ok
            if not sig_ok:
                reasons.append(sig_reason)

        ok = not reasons and signature_valid
        return VerificationResult(ok=ok, reasons=tuple(reasons), metadata=metadata, signature_valid=signature_valid)


__all__ = ["VaultproofVerifier", "VerificationResult"]
