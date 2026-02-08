"""x402 rail adapters (payment settlement backends).

Vaultfire uses x402 as a *payment-gating and ledgering* layer. The gateway
emits HTTP-402 style requirements and records billable events.

This module defines a minimal adapter interface for plugging in payment
rails without coupling Vaultfire to any one provider.

Mission-aligned goals:
- Privacy first: no identity metadata required to settle payments.
- Extensible: ETH on EVM, Assemble AI (ASM), NS3 rails can be added.
- Auditable: adapters emit structured receipts.

NOTE: Adapters here are intentionally lightweight. Production deployments
should harden signature verification, replay protection, and key storage.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping, Protocol


@dataclass(frozen=True, slots=True)
class X402PaymentReceipt:
    rail: str
    currency: str
    amount: float
    tx_ref: str | None = None
    payer: str | None = None
    meta: Mapping[str, Any] | None = None


class X402Rail(Protocol):
    rail_id: str

    def supports_currency(self, currency: str) -> bool: ...

    def parse_webhook(self, payload: Mapping[str, Any]) -> X402PaymentReceipt: ...


class EvmRail:
    rail_id = "evm"

    def supports_currency(self, currency: str) -> bool:
        return currency.upper() in {"ETH", "USDC"}

    def parse_webhook(self, payload: Mapping[str, Any]) -> X402PaymentReceipt:
        currency = str(payload.get("currency") or "ETH").upper()
        amount = float(payload.get("amount") or 0.0)
        return X402PaymentReceipt(
            rail=self.rail_id,
            currency=currency,
            amount=amount,
            tx_ref=payload.get("tx_hash") or payload.get("transaction_hash"),
            payer=payload.get("from") or payload.get("payer") or payload.get("wallet"),
            meta={"chain": payload.get("chain") or payload.get("network")},
        )


class AssembleRail:
    """Assemble AI rail stub.

    Normalizes inbound payment receipts denominated in ASM.
    """

    rail_id = "assemble"

    def supports_currency(self, currency: str) -> bool:
        return currency.upper() == "ASM"

    def parse_webhook(self, payload: Mapping[str, Any]) -> X402PaymentReceipt:
        amount = float(payload.get("amount") or 0.0)
        return X402PaymentReceipt(
            rail=self.rail_id,
            currency="ASM",
            amount=amount,
            tx_ref=payload.get("asm_tx") or payload.get("tx_ref") or payload.get("receipt_id"),
            payer=payload.get("wallet") or payload.get("payer"),
            meta={"ns3": payload.get("ns3"), "receipt_id": payload.get("receipt_id")},
        )


class Ns3Rail:
    """NS3 rail stub.

    Treats NS3 as a transport + session rail.
    """

    rail_id = "ns3"

    def supports_currency(self, currency: str) -> bool:
        return currency.upper() in {"ASM", "ETH", "USDC"}

    def parse_webhook(self, payload: Mapping[str, Any]) -> X402PaymentReceipt:
        currency = str(payload.get("currency") or "ASM").upper()
        amount = float(payload.get("amount") or 0.0)
        return X402PaymentReceipt(
            rail=self.rail_id,
            currency=currency,
            amount=amount,
            tx_ref=payload.get("tx_ref") or payload.get("session_id"),
            payer=payload.get("wallet") or payload.get("payer"),
            meta={"session": payload.get("session"), "route": payload.get("route")},
        )


DEFAULT_RAILS: Mapping[str, X402Rail] = {
    "evm": EvmRail(),
    "assemble": AssembleRail(),
    "ns3": Ns3Rail(),
}
