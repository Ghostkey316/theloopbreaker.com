"""Ghostkey AI Trader v1.0 plugin.

This module provides a sandboxed trading assistant for the Vaultfire protocol. It
operates only when explicitly activated by the user and respects the Ghostkey
Ethics Framework. All activity is recorded in an audit log. The assistant makes
no profit guarantees and does not constitute financial advice.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Callable, Dict, List, Optional

AUDIT_LOG = Path(__file__).resolve().parent.parent / "vaultfire-core" / "ethics" / "ai_trader_audit.json"


@dataclass
class GhostkeyAITrader:
    """Modular trading assistant sandboxed from core logic."""

    verify_wallet: Callable[[str], bool]
    opt_in: bool = False
    paused: bool = False
    risk_daily: Optional[float] = None
    risk_weekly: Optional[float] = None
    audit: List[Dict] = field(default_factory=list)
    auto_trade: bool = False
    strategy: Optional[Dict] = None

    def activate(self, confirm: bool = True) -> None:
        """Opt in to enable trading features."""
        if confirm:
            self.opt_in = True

    def pause(self) -> None:
        """Pause all automated trading."""
        self.paused = True

    def resume(self) -> None:
        self.paused = False

    def set_risk_caps(self, daily: Optional[float] = None, weekly: Optional[float] = None) -> None:
        self.risk_daily = daily
        self.risk_weekly = weekly

    def deploy_strategy(self, name: str, params: Dict) -> None:
        """Store user-approved strategy parameters."""
        self.strategy = {"name": name, "params": params}

    def toggle_auto_trade(self, enabled: bool) -> None:
        self.auto_trade = enabled

    def analyze_market(self, prices: List[float]) -> Dict:
        """Return a basic market trend analysis."""
        if not prices:
            return {"trend": "neutral"}
        direction = "up" if prices[-1] > prices[0] else "down"
        return {"trend": direction, "samples": len(prices)}

    def detect_signals(self, market_data: Dict) -> List[str]:
        """Placeholder signal detector."""
        signals = ["buy"] if market_data.get("trend") == "up" else ["sell"]
        try:  # optional core integration
            import vaultfire_core
            if hasattr(vaultfire_core, "protocol_notify"):
                vaultfire_core.protocol_notify("trade_signal", {"signals": signals})
        except Exception:
            pass
        return signals

    def _write_audit(self) -> None:
        AUDIT_LOG.parent.mkdir(parents=True, exist_ok=True)
        with open(AUDIT_LOG, "w") as f:
            json.dump(self.audit, f, indent=2)

    def execute_trade(self, wallet: str, trade: Dict) -> Dict:
        """Record trade if wallet verified and trader active."""
        try:
            if not self.opt_in or self.paused:
                raise RuntimeError("Trader not active")
            if not self.verify_wallet(wallet):
                raise RuntimeError("Unverified wallet")
            record = {
                "wallet": wallet,
                "trade": trade,
                "timestamp": datetime.utcnow().isoformat() + "Z",
            }
            self.audit.append(record)
            self._write_audit()
            try:
                import vaultfire_core
                if hasattr(vaultfire_core, "protocol_notify"):
                    vaultfire_core.protocol_notify("trade_executed", record)
            except Exception:
                pass
            return record
        except Exception as e:
            try:
                import vaultfire_core
                if hasattr(vaultfire_core, "protocol_notify"):
                    vaultfire_core.protocol_notify("error", {"error": str(e)})
            except Exception:
                pass
            raise

    def get_audit_log(self) -> List[Dict]:
        return list(self.audit)


__all__ = ["GhostkeyAITrader"]
