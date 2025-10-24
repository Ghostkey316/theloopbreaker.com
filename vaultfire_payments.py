"""Vaultfire payment orchestration with privacy preserving routes."""

from __future__ import annotations

from dataclasses import dataclass, field
from hashlib import sha256
import importlib
import importlib.util
import json
from pathlib import Path
import secrets
import time
from typing import Any, Dict, Iterable, Mapping, MutableMapping, Sequence

from vaultfire.x402_gateway import X402Gateway, X402Rule

__all__ = [
    "BeliefProxyRelay",
    "VaultfirePaymentRouter",
]


_PROXY_AUTH_PATH = Path("proxy_logless_auth.yaml")


@dataclass(slots=True)
class BeliefProxyRelay:
    """Represents a belief proxy relay that can anonymise payments."""

    relay_id: str
    endpoint: str
    rotation_interval: int = 900
    last_rotation: float = field(default_factory=lambda: 0.0)

    def should_rotate(self, *, now: float | None = None) -> bool:
        timestamp = now if now is not None else time.time()
        return timestamp - self.last_rotation >= self.rotation_interval

    def mark_rotated(self, *, now: float | None = None) -> None:
        self.last_rotation = now if now is not None else time.time()


class VaultfirePaymentRouter:
    """Coordinate x402 payments with anonymised proxy relays."""

    def __init__(
        self,
        *,
        gateway: X402Gateway | None = None,
        relays: Sequence[BeliefProxyRelay] | None = None,
        timeflare_endpoint: str | None = "https://timeflare.rpc",
    ) -> None:
        self._gateway = gateway or X402Gateway()
        self._shielded_mode = False
        self._timeflare_endpoint = timeflare_endpoint
        self._relays: MutableMapping[str, BeliefProxyRelay] = {
            relay.relay_id: relay for relay in (relays or self._default_relays())
        }
        self._proxy_policy = self._load_proxy_policy()

    # ------------------------------------------------------------------
    # public API
    # ------------------------------------------------------------------
    @property
    def shielded_mode(self) -> bool:
        return self._shielded_mode

    def enable_shielded_mode(self) -> None:
        self._shielded_mode = True

    def disable_shielded_mode(self) -> None:
        self._shielded_mode = False

    def toggle_shielded_mode(self, enabled: bool | None = None) -> bool:
        if enabled is None:
            enabled = not self._shielded_mode
        self._shielded_mode = bool(enabled)
        return self._shielded_mode

    def process_request(
        self,
        payload: Mapping[str, Any],
        *,
        endpoint: str,
        default_amount: float | None = None,
        passive_income_signal: bool = False,
    ) -> Mapping[str, Any]:
        """Process a monetised request through the anonymised network."""

        cleaned_payload = self._strip_metadata(payload)
        relay = self._select_relay(passive_income_signal=passive_income_signal)
        route = relay.endpoint if relay else self._timeflare_endpoint
        billable = passive_income_signal or cleaned_payload.get("billable", True)
        amount = cleaned_payload.get("amount", default_amount)
        metadata = {
            "relay": relay.relay_id if relay else "timeflare",
            "shielded": self._shielded_mode,
            "passive_signal": passive_income_signal,
        }
        result = self._gateway.execute(
            endpoint,
            lambda: self._dispatch(route, cleaned_payload),
            amount=amount,
            currency=cleaned_payload.get("currency"),
            metadata=metadata,
            billable=billable,
        )
        return {
            "status": "ok",
            "route": route,
            "relay": metadata["relay"],
            "payload_fingerprint": sha256(json.dumps(cleaned_payload, sort_keys=True).encode("utf-8")).hexdigest(),
            "result": result,
        }

    # ------------------------------------------------------------------
    # proxy helpers
    # ------------------------------------------------------------------
    def _default_relays(self) -> Iterable[BeliefProxyRelay]:
        return (
            BeliefProxyRelay(relay_id="ghost-alpha", endpoint="https://proxy.ghost.alpha"),
            BeliefProxyRelay(relay_id="ghost-beta", endpoint="https://proxy.ghost.beta"),
            BeliefProxyRelay(relay_id="ghost-gamma", endpoint="https://proxy.ghost.gamma"),
        )

    def _select_relay(self, *, passive_income_signal: bool) -> BeliefProxyRelay | None:
        if not self._shielded_mode and not passive_income_signal:
            return None
        now = time.time()
        eligible = sorted(
            self._relays.values(),
            key=lambda relay: relay.last_rotation,
        )
        for relay in eligible:
            if relay.should_rotate(now=now):
                relay.mark_rotated(now=now)
                return relay
        if eligible:
            chosen = secrets.choice(eligible)
            chosen.mark_rotated(now=now)
            return chosen
        return None

    def _dispatch(self, route: str | None, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        """Return a structured response for ledgering purposes."""

        timestamp = time.time()
        return {
            "timestamp": timestamp,
            "route": route,
            "payload": payload,
        }

    # ------------------------------------------------------------------
    # metadata + policy helpers
    # ------------------------------------------------------------------
    def _strip_metadata(self, payload: Mapping[str, Any]) -> Dict[str, Any]:
        sensitive_keys = {"ip", "origin", "wallet", "wallet_trail", "headers"}
        cleaned = {key: value for key, value in payload.items() if key not in sensitive_keys}
        cleaned.setdefault("session", self._issue_session_token())
        return cleaned

    def _issue_session_token(self) -> str:
        ttl = int(self._proxy_policy.get("ttl_seconds", 900))
        token = secrets.token_urlsafe(16)
        expiry = int(time.time()) + ttl
        return f"{token}:{expiry}"

    def _load_proxy_policy(self) -> Mapping[str, Any]:
        if not _PROXY_AUTH_PATH.exists():
            return {"ttl_seconds": 900, "wallet_access": []}
        text = _PROXY_AUTH_PATH.read_text(encoding="utf-8")
        spec = importlib.util.find_spec("yaml")
        if spec is not None:
            module = importlib.import_module("yaml")
            data = module.safe_load(text)
            return data or {}
        return self._parse_basic_yaml(text)

    def _parse_basic_yaml(self, text: str) -> Mapping[str, Any]:
        policy: Dict[str, Any] = {}
        current_list_key: str | None = None
        for raw_line in text.splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("-") and current_list_key:
                policy.setdefault(current_list_key, []).append(line.lstrip("- "))
                continue
            if ":" in line:
                key, value = line.split(":", 1)
                key = key.strip()
                value = value.strip()
                if value:
                    policy[key] = self._coerce_value(value)
                    current_list_key = None
                else:
                    policy[key] = []
                    current_list_key = key
        return policy

    def _coerce_value(self, value: str) -> Any:
        lowered = value.lower()
        if lowered in {"true", "false"}:
            return lowered == "true"
        if lowered.isdigit():
            return int(lowered)
        try:
            return float(value)
        except ValueError:
            return value

    # ------------------------------------------------------------------
    # rule registration helpers
    # ------------------------------------------------------------------
    def register_endpoint(
        self,
        endpoint: str,
        *,
        description: str,
        category: str = "default",
        minimum_charge: float = 0.0,
        currency: str = "ETH",
        wallet_free: bool = False,
        unlocks: Sequence[str] | None = None,
    ) -> None:
        rule = X402Rule(
            endpoint=endpoint,
            category=category,
            description=description,
            minimum_charge=minimum_charge,
            currency=currency,
            wallet_free=wallet_free,
            unlocks=unlocks or (),
        )
        self._gateway.register_rule(rule)

    def describe_rules(self) -> Mapping[str, Mapping[str, Any]]:
        return self._gateway.describe_rules()


def detect_passive_income_signal(payload: Mapping[str, Any]) -> bool:
    """Return ``True`` when the payload mirrors a passive yield event."""

    signal_type = str(payload.get("signal_type", "")).lower()
    if signal_type in {"yield", "passive_yield", "royalty"}:
        return True
    if "passive" in signal_type and "income" in signal_type:
        return True
    return bool(payload.get("passive_income"))
