"""x402 payment-gating service for Vaultfire.

This module provides a lightweight implementation of the proposed
``x402`` protocol so that Vaultfire endpoints can be wrapped with HTTP
402 style access controls.  The gateway keeps track of which endpoints
are monetised, records micropayments, and mirrors those records into a
Vaultfire specific ledger.  The design intentionally favours
extensibility over tight coupling with any single payment rail so that
future chain specific behaviour (NS3, Worldcoin ID, etc.) can be layered
on without modifying the core API.

The implementation focuses on a few guarantees:

* Every monetised endpoint is backed by a :class:`X402Rule` definition
  that specifies the default currency, minimum charge and behavioural
  hints.
* Calls that do not provide the required payment information raise an
  :class:`X402PaymentRequired` error which mirrors the semantics of an
  HTTP 402 response.
* Successful calls are written to an append-only JSONL ledger so that
  downstream tools (Vaultfire Ledger, Codex Memory synchronisers, etc.)
  can ingest the events.
* Suspicious activity (underpayment or repeated denials) is logged and
  marked so that the Vaultfire Relic Audit can be triggered by
  higher-level services.

The module intentionally avoids network operations – integration with
Coinbase or external x402 rails is expected to happen through the public
methods which expose structured event payloads.
"""

from __future__ import annotations

import json
import threading
import time
from typing import Any, Callable, Dict, Iterable, Mapping, MutableMapping

from dataclasses import dataclass, field
from pathlib import Path

from vaultfire.encryption import wrap_mapping

from .storage import DailyBackupManager
from .x402_privacy import (
    TraceBuffer,
    codex_redact_x402_trace,
    contains_identity_metadata,
    is_pre_authorised,
    log_blocked_event,
    scrub_identity_metadata,
    verify_x402_wallet,
    MAX_TRACE_WINDOW,
)

from Vaultfire.x402_rails import DEFAULT_RAILS

__all__ = [
    "X402PaymentRequired",
    "X402GatewayOffline",
    "X402Rule",
    "X402Gateway",
    "get_default_gateway",
]


GHOSTKEY_WALLET = "bpow20.cb.id"
GHOSTKEY_ENS = "ghostkey316.eth"
X402_GHOSTKEY_MODE = True


class X402PaymentRequired(RuntimeError):
    """Exception raised when a payment gated endpoint is accessed."""

    def __init__(self, endpoint: str, rule: "X402Rule") -> None:
        message = (
            f"HTTP 402 Payment Required for endpoint '{endpoint}'. "
            f"Charge at least {rule.minimum_charge:.8f} {rule.currency} "
            "to continue."
        )
        super().__init__(message)
        self.endpoint = endpoint
        self.rule = rule

    def user_message(self) -> str:
        """Return a human readable explanation suitable for CLI output."""

        return str(self)

    def to_dict(self) -> Dict[str, Any]:
        """Return a structured payload that mirrors an HTTP 402 response."""

        return {
            "status": 402,
            "endpoint": self.endpoint,
            "currency": self.rule.currency,
            "minimum_charge": self.rule.minimum_charge,
            "category": self.rule.category,
            "message": self.user_message(),
        }


class X402GatewayOffline(RuntimeError):
    """Raised when the gateway cannot persist ledger events."""

    def __init__(self, message: str, *, path: Path | None = None) -> None:
        if path is not None:
            message = f"{message} ({path})"
        super().__init__(message)
        self.path = path


@dataclass(slots=True)
class X402Rule:
    """Configuration for an x402 monetised endpoint."""

    endpoint: str
    category: str
    description: str
    minimum_charge: float
    currency: str = "ETH"
    default_amount: float | None = None
    wallet_free: bool = True
    unlocks: Iterable[str] = field(default_factory=tuple)

    def requires_payment(self) -> bool:
        """Return ``True`` when the endpoint enforces a payment."""

        return self.minimum_charge > 0 or bool(self.default_amount)


class X402Gateway:
    """Runtime gateway that enforces x402 rules and logs billable events."""

    def __init__(
        self,
        *,
        identity_handle: str = GHOSTKEY_WALLET,
        identity_ens: str = GHOSTKEY_ENS,
        ledger_path: Path | None = None,
        codex_memory_path: Path | None = None,
        ghostkey_earnings_path: Path | None = None,
        companion_path: Path | None = None,
        backup_manager: DailyBackupManager | None = None,
    ) -> None:
        self.identity_handle = identity_handle
        self.identity_ens = identity_ens
        self.ledger_path = ledger_path or Path("logs/x402_ledger.jsonl")
        self.codex_memory_path = codex_memory_path or Path("logs/x402_memory.jsonl")
        self.ghostkey_earnings_path = ghostkey_earnings_path or Path("logs/x402_ghostkey_earnings.jsonl")
        self.companion_path = companion_path or Path("logs/x402_companion.jsonl")
        self._backup_manager = backup_manager or DailyBackupManager()
        self._rules: MutableMapping[str, X402Rule] = {}
        # Rail adapters (EVM/ASM/NS3, etc.) used for best-effort currency validation.
        self._rails = dict(DEFAULT_RAILS)
        self._lock = threading.Lock()
        self._denial_counts: MutableMapping[str, int] = {}
        self.ghostkey_mode = X402_GHOSTKEY_MODE
        self.max_trace_window = MAX_TRACE_WINDOW
        self._trace_buffer = TraceBuffer()
        for rule in _DEFAULT_RULES:
            self.register_rule(rule)

    # ------------------------------------------------------------------
    # rule handling
    # ------------------------------------------------------------------
    def register_rule(self, rule: X402Rule) -> None:
        """Register or replace an x402 rule."""

        self._rules[rule.endpoint] = rule

    def describe_rules(self) -> Dict[str, Mapping[str, Any]]:
        """Return a serialisable snapshot of the configured rules."""

        return {
            endpoint: {
                "category": rule.category,
                "description": rule.description,
                "minimum_charge": rule.minimum_charge,
                "currency": rule.currency,
                "default_amount": rule.default_amount,
                "wallet_free": rule.wallet_free,
                "unlocks": list(rule.unlocks),
            }
            for endpoint, rule in self._rules.items()
        }

    # ------------------------------------------------------------------
    # execution helpers
    # ------------------------------------------------------------------
    def _ensure_metadata_permitted(self, metadata: Mapping[str, Any]) -> None:
        if not metadata:
            return
        if contains_identity_metadata(metadata) and not is_pre_authorised(metadata):
            log_blocked_event("identity_metadata_rejected", metadata)
            raise PermissionError("identity metadata is not permitted for x402 events")

    def _prepare_metadata(
        self,
        metadata: Mapping[str, Any],
        *,
        wallet_address: str,
        wallet_classification: str,
    ) -> Dict[str, Any]:
        cleaned = scrub_identity_metadata(metadata)
        cleaned.update(
            {
                "wallet_address": wallet_address,
                "wallet_classification": wallet_classification,
                "ghostkey_mode": self.ghostkey_mode,
                "anonymity_required": True,
                "trace_window": self.max_trace_window,
                "signal_route": ["signal", "wallet", "belief", "yield"],
                "metadata_scrubbed": True,
            }
        )
        return cleaned

    def _store_trace(self, payload: Mapping[str, Any]) -> None:
        self._trace_buffer.append(payload)
        if self.max_trace_window <= 0:
            self._trace_buffer.clear()

    def _check_redaction_trigger(self, metadata: Mapping[str, Any]) -> None:
        trigger_phrase = str(metadata.get("trigger_phrase", "")).strip().lower()
        if trigger_phrase == "ghostkey vanish".lower():
            codex_redact_x402_trace(self._trace_buffer)

    def execute(
        self,
        endpoint: str,
        callback: Callable[[], Any],
        *,
        amount: float | None = None,
        currency: str | None = None,
        metadata: Mapping[str, Any] | None = None,
        billable: bool | None = None,
        wallet_address: str | None = None,
        belief_signal: Mapping[str, Any] | None = None,
        signature: str | None = None,
        wallet_type: str | None = None,
    ) -> Any:
        """Execute ``callback`` guarded by the x402 rule for ``endpoint``.

        The method raises :class:`X402PaymentRequired` when a payment is
        mandatory but no amount is provided.  On success the call is
        recorded in the ledger.
        """

        metadata = metadata or {}
        wallet_address = wallet_address or self.identity_handle
        self._ensure_metadata_permitted(metadata)
        verified, classification = verify_x402_wallet(
            wallet_address,
            belief_signal=belief_signal,
            signature=signature,
            wallet_type=wallet_type,
        )
        if not verified:
            log_blocked_event(
                "wallet_verification_failed",
                {
                    "wallet_address": wallet_address,
                    "endpoint": endpoint,
                    "classification": classification,
                },
            )
            raise PermissionError("x402 requires a verified wallet signal in ghostkey mode")

        rule = self._rules.get(endpoint)
        charge_amount: float | None = amount
        if rule:
            if charge_amount is None:
                charge_amount = rule.default_amount
            if billable is None:
                billable = rule.requires_payment()
            if billable and (charge_amount is None or charge_amount < rule.minimum_charge):
                self._note_denial(endpoint)
                raise X402PaymentRequired(endpoint, rule)
        elif billable:
            # Endpoint not registered but explicitly billable.
            raise X402PaymentRequired(
                endpoint,
                X402Rule(
                    endpoint=endpoint,
                    category="custom",
                    description="unregistered endpoint",
                    minimum_charge=charge_amount or 0,
                    currency=currency or "ETH",
                ),
            )

        result = callback()

        prepared_metadata = self._prepare_metadata(
            metadata,
            wallet_address=wallet_address,
            wallet_classification=classification,
        )
        self._store_trace({
            "endpoint": endpoint,
            "wallet": wallet_address,
            "classification": classification,
        })
        self._check_redaction_trigger(prepared_metadata)

        if charge_amount and charge_amount > 0:
            resolved_currency = (currency or (rule.currency if rule else "ETH")).upper()
            supported = any(
                getattr(rail, "supports_currency", lambda _: False)(resolved_currency)
                for rail in self._rails.values()
            )
            if not supported:
                prepared_metadata = dict(prepared_metadata)
                prepared_metadata["currency_unrecognized"] = True
            self._record_transaction(
                endpoint=endpoint,
                amount=charge_amount,
                currency=resolved_currency,
                metadata=prepared_metadata,
                unlocks=rule.unlocks if rule else (),
            )
        else:
            self._record_access(endpoint=endpoint, metadata=prepared_metadata)

        return result

    # ------------------------------------------------------------------
    # logging helpers
    # ------------------------------------------------------------------
    def _record_transaction(
        self,
        *,
        endpoint: str,
        amount: float,
        currency: str,
        metadata: Mapping[str, Any],
        unlocks: Iterable[str],
    ) -> None:
        """Append a billable event to the ledger and codex memory log."""

        entry = {
            "timestamp": time.time(),
            "endpoint": endpoint,
            "amount": round(float(amount), 12),
            "currency": currency,
            "identity_handle": self.identity_handle,
            "identity_ens": self.identity_ens,
            "metadata": dict(metadata),
            "unlocks": list(unlocks),
            "event": "payment",
        }
        self._append_jsonl(self.ledger_path, entry)
        self._append_jsonl(self.codex_memory_path, {
            "timestamp": entry["timestamp"],
            "event": "codex-memory",
            "details": entry,
        })
        self._record_ghostkey_earning(entry)
        self._record_companion(entry)
        self._reset_denial(endpoint)

    def _record_access(self, *, endpoint: str, metadata: Mapping[str, Any]) -> None:
        entry = {
            "timestamp": time.time(),
            "endpoint": endpoint,
            "identity_handle": self.identity_handle,
            "identity_ens": self.identity_ens,
            "metadata": dict(metadata),
            "event": "access",
        }
        self._append_jsonl(self.ledger_path, entry)
        self._record_ghostkey_earning(entry)
        self._record_companion(entry)

    def _append_jsonl(self, path: Path, payload: Mapping[str, Any]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        try:
            record = wrap_mapping(
                "x402-anonymized-map",
                payload,
                preserve_keys=("timestamp", "event", "endpoint"),
            )
            with self._lock:
                with path.open("a", encoding="utf-8") as fp:
                    json.dump(record, fp, separators=(",", ":"))
                    fp.write("\n")
            if path in (self.ledger_path, self.codex_memory_path, self.companion_path):
                self._backup_manager.maybe_snapshot(path, label=path.stem)
        except OSError as exc:  # pragma: no cover - filesystem specific
            raise X402GatewayOffline("x402 gateway ledger unavailable", path=path) from exc

    def _record_ghostkey_earning(self, entry: Mapping[str, Any]) -> None:
        summary = {
            "timestamp": entry.get("timestamp", time.time()),
            "identity": self.identity_handle,
            "endpoint": entry.get("endpoint"),
            "amount": entry.get("amount"),
            "currency": entry.get("currency"),
            "metadata": entry.get("metadata", {}),
            "event": entry.get("event", "payment"),
        }
        self._append_jsonl(self.ghostkey_earnings_path, summary)

    def _record_companion(self, entry: Mapping[str, Any]) -> None:
        payload = {
            "timestamp": entry.get("timestamp", time.time()),
            "event": "companion-update",
            "details": {
                "endpoint": entry.get("endpoint"),
                "amount": entry.get("amount"),
                "currency": entry.get("currency"),
                "metadata": entry.get("metadata", {}),
            },
        }
        self._append_jsonl(self.companion_path, payload)

    def record_external_event(
        self,
        *,
        event_type: str,
        status: str,
        amount: float | None = None,
        currency: str | None = None,
        metadata: Mapping[str, Any] | None = None,
        wallet_address: str | None = None,
        belief_signal: Mapping[str, Any] | None = None,
        signature: str | None = None,
        wallet_type: str | None = None,
    ) -> Mapping[str, Any]:
        """Record an externally triggered x402 event."""

        metadata = metadata or {}
        wallet_address = wallet_address or self.identity_handle
        self._ensure_metadata_permitted(metadata)
        verified, classification = verify_x402_wallet(
            wallet_address,
            belief_signal=belief_signal,
            signature=signature,
            wallet_type=wallet_type,
        )
        if not verified:
            log_blocked_event(
                "wallet_verification_failed",
                {
                    "wallet_address": wallet_address,
                    "event_type": event_type,
                    "classification": classification,
                },
            )
            raise PermissionError("x402 external events require a verified wallet")

        prepared_metadata = self._prepare_metadata(
            metadata,
            wallet_address=wallet_address,
            wallet_classification=classification,
        )
        self._store_trace(
            {
                "event_type": event_type,
                "wallet": wallet_address,
                "classification": classification,
            }
        )
        self._check_redaction_trigger(prepared_metadata)

        entry = {
            "timestamp": time.time(),
            "event": "webhook",
            "event_type": event_type,
            "status": status,
            "amount": round(float(amount), 12) if amount is not None else None,
            "currency": currency,
            "identity_handle": self.identity_handle,
            "identity_ens": self.identity_ens,
            "metadata": prepared_metadata,
        }
        self._append_jsonl(self.ledger_path, entry)
        self._append_jsonl(
            self.codex_memory_path,
            {
                "timestamp": entry["timestamp"],
                "event": "codex-memory",
                "details": entry,
            },
        )
        self._record_ghostkey_earning(entry)
        self._record_companion(entry)
        return entry

    # ------------------------------------------------------------------
    # denial tracking and auditing
    # ------------------------------------------------------------------
    def _note_denial(self, endpoint: str) -> None:
        count = self._denial_counts.get(endpoint, 0) + 1
        self._denial_counts[endpoint] = count
        if count >= 3:
            # After repeated denials we mirror an audit event so that the
            # Relic Audit can pick it up.
            self._record_access(
                endpoint=f"audit::{endpoint}",
                metadata={
                    "reason": "repeated_denial",
                    "denials": count,
                },
            )

    def _reset_denial(self, endpoint: str) -> None:
        if endpoint in self._denial_counts:
            del self._denial_counts[endpoint]


_DEFAULT_RULES: tuple[X402Rule, ...] = (
    X402Rule(
        endpoint="api.vaultfire.query",
        category="api",
        description="Vaultfire API queries gated by x402",
        minimum_charge=0.00042,
        currency="ETH",
        default_amount=0.00042,
        unlocks=("vaultfire_api_access",),
    ),
    X402Rule(
        endpoint="codex.function.unlock",
        category="codex",
        description="Codex function unlock token",
        minimum_charge=0.00021,
        currency="ASM",
        default_amount=0.00021,
        unlocks=("codex_function",),
    ),
    X402Rule(
        endpoint="drops.weekly",
        category="drops",
        description="Weekly drop activation via x402",
        minimum_charge=0.0005,
        currency="WLD",
        default_amount=0.0005,
        unlocks=("weekly_drop", "vaultfire_badge"),
    ),
    X402Rule(
        endpoint="yield.passive_module",
        category="yield",
        description="Passive yield module trigger",
        minimum_charge=0.00031,
        currency="ETH",
        default_amount=0.00031,
        unlocks=("passive_yield",),
    ),
    X402Rule(
        endpoint="codex.trigger_belief_mirror",
        category="codex",
        description="Belief mirror trigger",
        minimum_charge=0.00025,
        currency="ASM",
        default_amount=0.00025,
        unlocks=("belief_mirror", "vaultfire_prompt"),
    ),
    X402Rule(
        endpoint="codex.run_passive_loop",
        category="codex",
        description="Passive loop execution",
        minimum_charge=0.00029,
        currency="ETH",
        default_amount=0.00029,
        unlocks=("passive_loop",),
    ),
    X402Rule(
        endpoint="codex.validate_loyalty_action",
        category="codex",
        description="Loyalty action validator",
        minimum_charge=0.00019,
        currency="ASM",
        default_amount=0.00019,
        unlocks=("loyalty_validation", "secret_prompt"),
    ),
    X402Rule(
        endpoint="cli.vaultfire.sh",
        category="cli",
        description="Vaultfire companion CLI access gate",
        minimum_charge=0.0001,
        currency="ETH",
        default_amount=0.0001,
        unlocks=("cli_toolchain",),
    ),
    X402Rule(
        endpoint="cli.codex_engine_pulse",
        category="cli",
        description="Codex engine pulse execution",
        minimum_charge=0.0002,
        currency="ETH",
        default_amount=0.0002,
        unlocks=("codex_pulse",),
    ),
    X402Rule(
        endpoint="cli.nft_gateway_unlock",
        category="cli",
        description="NFT gateway unlock guard",
        minimum_charge=0.0002,
        currency="ETH",
        default_amount=0.0002,
        unlocks=("nft_gateway",),
    ),
)


_DEFAULT_GATEWAY: X402Gateway | None = None


def get_default_gateway() -> X402Gateway:
    """Return a process-wide shared :class:`X402Gateway`."""

    global _DEFAULT_GATEWAY
    if _DEFAULT_GATEWAY is None:
        _DEFAULT_GATEWAY = X402Gateway()
    return _DEFAULT_GATEWAY

