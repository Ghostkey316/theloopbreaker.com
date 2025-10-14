"""Sandbox CLI with reduced permissions for pilot simulations."""

from __future__ import annotations

import argparse
import json
from dataclasses import asdict, dataclass
from typing import Iterable, Mapping, Sequence

from vaultfire.modules import FULL_STACK_MODE, LITE_MODE, ModuleInfo, get_modules_for_mode
from vaultfire.pilot_mode.sandbox import YieldSandbox
from vaultfire.security import crypto_disclaimer


@dataclass
class _MemoryReference:
    partner_tag: str
    reference_type: str
    payload: Mapping[str, object]
    metadata: Mapping[str, object]

    def export(self) -> Mapping[str, object]:
        base = dict(self.metadata)
        base.update({
            "partner_tag": self.partner_tag,
            "reference_type": self.reference_type,
            "payload": dict(self.payload),
        })
        return base


class _MemoryLedger:
    """In-memory ledger used to avoid filesystem writes in sandbox mode."""

    def __init__(self) -> None:
        self._records: list[_MemoryReference] = []

    @property
    def records(self) -> Sequence[_MemoryReference]:
        return tuple(self._records)

    def record_reference(
        self,
        *,
        partner_tag: str,
        reference_type: str,
        payload: Mapping[str, object],
        metadata: Mapping[str, object] | None = None,
    ) -> _MemoryReference:
        reference = _MemoryReference(
            partner_tag=partner_tag,
            reference_type=reference_type,
            payload=dict(payload),
            metadata=dict(metadata or {}),
        )
        self._records.append(reference)
        return reference


def _modules_payload(mode: str) -> Mapping[str, object]:
    modules: Iterable[ModuleInfo] = get_modules_for_mode(mode)
    return {
        "mode": mode,
        "status": "pending_audit",
        "disclaimer": crypto_disclaimer(),
        "modules": [module.as_dict() for module in modules],
    }


def handle_simulate(
    *,
    partner: str,
    wallet: str,
    strategy: str,
    sample_size: int,
    mode: str,
) -> int:
    ledger = _MemoryLedger()
    sandbox = YieldSandbox(ledger=ledger)
    session_id = f"pilot-{partner.lower()}"
    result = sandbox.simulate_yield(
        partner_tag=partner,
        session_id=session_id,
        wallet_id=wallet,
        strategy_id=strategy,
        sample_size=sample_size,
        telemetry_flags={"sandbox": True, "mode": mode},
    )
    output = {
        "disclaimer": crypto_disclaimer(),
        "sandbox": True,
        "session": asdict(result),
        "onboarding": _modules_payload(mode),
        "references": [ref.export() for ref in ledger.records],
    }
    print(json.dumps(output, indent=2, sort_keys=True))
    return 0


def handle_modules(*, mode: str) -> int:
    payload = _modules_payload(mode)
    print(json.dumps(payload, indent=2, sort_keys=True))
    return 0


def create_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="vaultfire-sandbox-cli",
        description="Run sandbox-only Vaultfire partner simulations",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    simulate = subparsers.add_parser("simulate", help="Generate a synthetic sandbox run")
    simulate.add_argument("--partner", required=True, help="Partner tag for the simulation")
    simulate.add_argument("--wallet", required=True, help="Sandbox wallet identifier")
    simulate.add_argument("--strategy", required=True, help="Strategy identifier")
    simulate.add_argument(
        "--sample-size",
        type=int,
        default=120,
        help="Sample size for synthetic simulation (default: 120)",
    )
    simulate.add_argument(
        "--mode",
        choices=(LITE_MODE, FULL_STACK_MODE),
        default=LITE_MODE,
        help="Module scope to preview",
    )

    modules = subparsers.add_parser("modules", help="Inspect sandbox module scopes")
    modules.add_argument(
        "--mode",
        choices=(LITE_MODE, FULL_STACK_MODE),
        default=LITE_MODE,
        help="Module scope to inspect",
    )

    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = create_parser()
    args = parser.parse_args(argv)
    if args.command == "simulate":
        return handle_simulate(
            partner=args.partner,
            wallet=args.wallet,
            strategy=args.strategy,
            sample_size=args.sample_size,
            mode=args.mode,
        )
    if args.command == "modules":
        return handle_modules(mode=args.mode)
    parser.error("Unknown command")


__all__ = ["create_parser", "handle_modules", "handle_simulate", "main"]
