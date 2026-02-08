"""Minimal local server for the x402 webhook + dashboard.

This is intentionally tiny so partners can run the x402 demo without
needing the full Vaultfire onboarding API stack.

Run:
  python scripts/run_x402_listener.py

Then:
  GET  http://localhost:5000/vaultfire/x402-webhook
  POST http://localhost:5000/vaultfire/x402-webhook

Env:
  VAULTFIRE_X402_PARTNER_KEYS_JSON (recommended)
"""

from __future__ import annotations

import json
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import parse_qs, urlparse

# Ensure repo root is importable even when this script is executed by full path.
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[1]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

# Ensure `vaultfire.*` imports resolve even if the package directory is `Vaultfire/`.
import sitecustomize  # noqa: F401


def _run_flask() -> None:
    """Run the canonical Flask listener when Flask is available."""

    from flask import Flask

    from vaultfire.x402_listener import x402EventListener

    app = Flask(__name__)
    x402EventListener(app)
    app.run(host="127.0.0.1", port=5000, debug=False)


def _json_response(handler: BaseHTTPRequestHandler, status: int, payload: Any) -> None:
    raw = json.dumps(payload, indent=2).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(raw)))
    handler.end_headers()
    handler.wfile.write(raw)


def _run_stdlib() -> None:
    """Run a no-deps HTTP server implementing the same x402 webhook contract.

    This exists so the x402 demo can run in minimal environments where Flask
    is not installed. It is intentionally small and only implements the two
    endpoints used by the demo:
      - GET/POST /vaultfire/x402-webhook
      - GET      /vaultfire/x402-dashboard
    """

    from vaultfire.x402_dashboard import aggregate_totals, count_total_events, load_dashboard_entries
    from vaultfire.x402_gateway import get_default_gateway
    from vaultfire.x402_receipts import get_partner_secret, get_partner_secret_by_id, verify_hmac_receipt

    gateway = get_default_gateway()

    class Handler(BaseHTTPRequestHandler):
        server_version = "vaultfire-x402-stdlib/1.0"

        def log_message(self, fmt: str, *args: Any) -> None:  # quiet by default
            return

        def do_GET(self) -> None:  # noqa: N802
            parsed = urlparse(self.path)
            if parsed.path == "/vaultfire/x402-webhook":
                return _json_response(
                    self,
                    200,
                    {
                        "status": "listening",
                        "identity": gateway.identity_handle,
                        "ledger": str(gateway.ledger_path),
                        "ghostkey_mode": gateway.ghostkey_mode,
                        "anonymity_required": True,
                        "mode": "stdlib",
                    },
                )

            if parsed.path == "/vaultfire/x402-dashboard":
                qs = parse_qs(parsed.query)
                try:
                    limit = int((qs.get("limit") or ["50"])[0])
                except Exception:
                    limit = 50
                entries = load_dashboard_entries(limit=limit, gateway=gateway)
                totals = aggregate_totals(entries)
                return _json_response(
                    self,
                    200,
                    {
                        "events": entries,
                        "totals": totals,
                        "count": count_total_events(gateway=gateway),
                        "mode": "stdlib",
                    },
                )

            return _json_response(self, 404, {"status": "not_found", "path": parsed.path})

        def do_POST(self) -> None:  # noqa: N802
            parsed = urlparse(self.path)
            if parsed.path != "/vaultfire/x402-webhook":
                return _json_response(self, 404, {"status": "not_found", "path": parsed.path})

            length = int(self.headers.get("Content-Length", "0") or "0")
            raw = self.rfile.read(length) if length > 0 else b"{}"
            try:
                payload = json.loads(raw.decode("utf-8") or "{}")
            except Exception:
                payload = {}

            event_type = payload.get("type") or payload.get("event_type") or "payment"
            status = payload.get("status") or payload.get("payment_status") or "received"
            amount = payload.get("amount")
            try:
                amount_value = float(amount) if amount is not None else None
            except Exception:
                amount_value = None
            currency = payload.get("currency")
            rail = payload.get("rail") or payload.get("provider")
            wallet_address = payload.get("wallet_address") or payload.get("wallet") or gateway.identity_handle
            belief_signal = payload.get("belief_signal") if isinstance(payload.get("belief_signal"), dict) else None
            signature = payload.get("signature") or payload.get("codex_signature") or "codex::listener"
            wallet_type = payload.get("wallet_type")
            trigger_phrase = payload.get("trigger_phrase") or payload.get("command")

            partner_id = payload.get("partner_id") or payload.get("issuer")
            key_id = payload.get("key_id") or payload.get("kid")

            if rail in {"assemble", "ns3"}:
                partner_secret = get_partner_secret_by_id(partner_id=partner_id, key_id=key_id)
                if not partner_secret:
                    partner_secret = get_partner_secret(rail)
                    require_partner = False
                else:
                    require_partner = True

                if not partner_secret:
                    return _json_response(
                        self,
                        403,
                        {"status": "rejected", "reason": f"missing partner key for rail {rail}"},
                    )

                verdict = verify_hmac_receipt(payload, secret=partner_secret, require_partner=require_partner)
                if not verdict.ok:
                    return _json_response(self, 403, {"status": "rejected", "reason": verdict.reason})

            metadata = {
                "tx_hash": payload.get("tx_hash") or payload.get("transaction_hash"),
                "loyalty_score": payload.get("loyalty_score"),
                "authorized_by": payload.get("authorized_by"),
                "relay": payload.get("relay"),
                "rail": rail,
                "partner_id": partner_id,
                "key_id": key_id,
                "trigger_phrase": trigger_phrase,
            }

            try:
                entry = gateway.record_external_event(
                    event_type=event_type,
                    status=status,
                    amount=amount_value,
                    currency=currency,
                    metadata=metadata,
                    wallet_address=wallet_address,
                    belief_signal=belief_signal,
                    signature=signature,
                    wallet_type=wallet_type,
                )
            except PermissionError as exc:
                return _json_response(self, 403, {"status": "rejected", "reason": str(exc)})

            return _json_response(self, 200, {"status": "ok", "entry": entry, "mode": "stdlib"})

    server = ThreadingHTTPServer(("127.0.0.1", 5000), Handler)
    print("[x402] stdlib listener running on http://127.0.0.1:5000 (no Flask)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


def main() -> None:
    try:
        import flask  # noqa: F401

        return _run_flask()
    except Exception:
        # Flask is optional for the demo. Fall back to stdlib server.
        return _run_stdlib()


if __name__ == "__main__":
    main()
