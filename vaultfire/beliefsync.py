"""NS3 BeliefSync integration layer."""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Mapping, MutableMapping

import httpx

from utils.belief_signer import BeliefSigner


@dataclass
class BeliefSyncResult:
    """Result returned by :meth:`BeliefSync.push_to_ns3`."""

    payload: Mapping[str, Any]
    envelope: Mapping[str, Any]
    response: Mapping[str, Any] | None
    receipt_valid: bool


class BeliefSync:
    """Translate vaultloop snapshots into NS3-compatible belief payloads."""

    def __init__(
        self,
        signer: BeliefSigner,
        *,
        ns3_endpoint: str = "https://ns3.local/sync/beliefs",
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        self.signer = signer
        self.ns3_endpoint = ns3_endpoint
        self._clock = clock or (lambda: datetime.now(timezone.utc))
        self.last_payload: Mapping[str, Any] | None = None

    def sync_from_vaultloop(self, snapshot: Mapping[str, Any]) -> MutableMapping[str, Any]:
        """Convert a vaultloop snapshot into an NS3 belief payload."""

        if not isinstance(snapshot, Mapping):
            raise TypeError("vaultloop snapshot must be a mapping")

        now = self._clock()

        validator_id = snapshot.get("validator_id")
        if not validator_id:
            raise ValueError("snapshot missing validator_id")

        belief_hash = snapshot.get("belief_hash") or self._hash_snapshot(snapshot)
        pop_score = self._extract_pop_score(snapshot)
        amplifier_strength = self._extract_amplifier_strength(snapshot)
        drip_delta = self._calculate_drip_delta(snapshot, now)
        loop_recall_vector = self._build_loop_recall_vector(snapshot)

        payload: MutableMapping[str, Any] = {
            "validator_id": validator_id,
            "belief_hash": belief_hash,
            "PoP_score": pop_score,
            "amplifier_strength": amplifier_strength,
            "timestamp": now.isoformat(),
            "drip_delta": drip_delta,
            "loop_recall_vector": loop_recall_vector,
        }

        self.last_payload = payload
        return payload

    def push_to_ns3(self, payload: Mapping[str, Any]) -> BeliefSyncResult:
        """Sign and forward a payload to the NS3 endpoint."""

        self._validate_payload(payload)
        timestamp = self._clock()
        signature = self.signer.sign(payload, timestamp=timestamp)
        if not self.signer.verify(payload, signature, timestamp=timestamp, tolerance_windows=0):
            raise ValueError("payload failed tamper verification before dispatch")

        envelope = {
            "payload": payload,
            "signature": signature,
            "timestamp": timestamp.isoformat(),
        }

        response_json: Mapping[str, Any] | None
        response_json = None
        resp = httpx.post(self.ns3_endpoint, json=envelope, timeout=5)
        resp.raise_for_status()
        try:
            response_json = resp.json()
        except ValueError:
            response_json = None

        receipt_valid = False
        receipt = None
        if isinstance(response_json, Mapping):
            receipt = response_json.get("receipt")
            if receipt:
                receipt_valid = self.validate_receipt(receipt)

        return BeliefSyncResult(
            payload=payload, envelope=envelope, response=response_json, receipt_valid=receipt_valid
        )

    def validate_receipt(self, receipt: Mapping[str, Any]) -> bool:
        """Validate an NS3 receipt using the configured signer."""

        if not isinstance(receipt, Mapping):
            return False

        payload = receipt.get("payload")
        signature = receipt.get("signature")
        ts_raw = receipt.get("timestamp")

        if not isinstance(payload, Mapping) or not isinstance(signature, str):
            return False

        receipt_ts = self._parse_timestamp(ts_raw) if ts_raw else None
        return self.signer.verify(payload, signature, timestamp=receipt_ts)

    def _calculate_drip_delta(self, snapshot: Mapping[str, Any], now: datetime) -> float:
        if "drip_delta" in snapshot:
            try:
                return float(snapshot["drip_delta"])
            except (TypeError, ValueError):
                pass

        history = snapshot.get("drip_history") or []
        cutoff = now - timedelta(hours=24)
        total = 0.0
        for entry in history:
            if not isinstance(entry, Mapping):
                continue
            ts_raw = entry.get("timestamp")
            value = entry.get("value") or entry.get("reward") or entry.get("amount")
            if ts_raw is None or value is None:
                continue
            ts = self._parse_timestamp(ts_raw)
            if ts >= cutoff:
                total += float(value)
        return total

    def _build_loop_recall_vector(self, snapshot: Mapping[str, Any]) -> str:
        if snapshot.get("loop_recall_vector"):
            return str(snapshot["loop_recall_vector"])

        history = snapshot.get("loop_history") or snapshot.get("loop_states") or []
        last_states = history[-7:]
        canonical = json.dumps(last_states, sort_keys=True, separators=(",", ":"), default=str)
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    def _hash_snapshot(self, snapshot: Mapping[str, Any]) -> str:
        canonical = json.dumps(snapshot, sort_keys=True, separators=(",", ":"), default=str)
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    def _extract_pop_score(self, snapshot: Mapping[str, Any]) -> float:
        candidates = [
            snapshot.get("PoP_score"),
            snapshot.get("pop_score"),
            snapshot.get("pop"),
        ]
        for candidate in candidates:
            if candidate is not None:
                return float(candidate)
        raise ValueError("snapshot missing PoP score")

    def _extract_amplifier_strength(self, snapshot: Mapping[str, Any]) -> float:
        candidates = [
            snapshot.get("amplifier_strength"),
            snapshot.get("amplifier", {}).get("strength") if isinstance(snapshot.get("amplifier"), Mapping) else None,
            snapshot.get("amplifier", {}).get("multiplier") if isinstance(snapshot.get("amplifier"), Mapping) else None,
            snapshot.get("amplifier_boost"),
        ]
        for candidate in candidates:
            if candidate is not None:
                return float(candidate)
        raise ValueError("snapshot missing amplifier strength")

    def _parse_timestamp(self, ts: Any) -> datetime:
        if isinstance(ts, datetime):
            return ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)
        if isinstance(ts, (int, float)):
            return datetime.fromtimestamp(ts, tz=timezone.utc)
        if isinstance(ts, str):
            try:
                cleaned = ts.replace("Z", "+00:00") if ts.endswith("Z") else ts
                parsed = datetime.fromisoformat(cleaned)
            except ValueError:
                raise
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        raise TypeError("timestamp must be a datetime, numeric epoch, or ISO string")

    def _validate_payload(self, payload: Mapping[str, Any]) -> None:
        required = {
            "validator_id",
            "belief_hash",
            "PoP_score",
            "amplifier_strength",
            "timestamp",
            "drip_delta",
            "loop_recall_vector",
        }
        missing = sorted(required.difference(payload.keys()))
        if missing:
            raise ValueError(f"payload missing required fields: {', '.join(missing)}")
