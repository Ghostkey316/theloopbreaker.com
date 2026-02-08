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

from flask import Flask

# Ensure `vaultfire.*` imports resolve even if the package directory is `Vaultfire/`.
import sitecustomize  # noqa: F401

from vaultfire.x402_listener import x402EventListener


def main() -> None:
    app = Flask(__name__)
    x402EventListener(app)
    app.run(host="127.0.0.1", port=5000, debug=False)


if __name__ == "__main__":
    main()
