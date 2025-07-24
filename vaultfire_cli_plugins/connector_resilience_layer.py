import argparse
import json
from pathlib import Path

from engine.connector_resilience_layer import (
    detect_missing_connectors,
    manual_sync,
    register_endpoint,
    set_connector_enabled,
)


def _cmd_check(_: argparse.Namespace) -> None:
    missing = detect_missing_connectors()
    if missing:
        print(json.dumps({"missing": missing}, indent=2))
    else:
        print("all connectors available")


def _cmd_manual(args: argparse.Namespace) -> None:
    payload = json.loads(Path(args.payload).read_text())
    result = manual_sync(args.connector, payload, args.source, args.signature)
    print(json.dumps(result, indent=2))


def _cmd_register(args: argparse.Namespace) -> None:
    register_endpoint(args.connector, args.endpoint)
    print("endpoint registered")


def _cmd_toggle(args: argparse.Namespace) -> None:
    enabled = args.enable
    if args.disable:
        enabled = False
    set_connector_enabled(args.connector, enabled)
    state = "enabled" if enabled else "disabled"
    print(f"{args.connector} {state}")


def register(subparsers: argparse._SubParsersAction) -> None:
    p_check = subparsers.add_parser(
        "check-connectors", help="List missing connectors"
    )
    p_check.set_defaults(func=_cmd_check)

    p_sync = subparsers.add_parser(
        "manual-sync", help="Run manual connector sync"
    )
    p_sync.add_argument("connector", help="Connector name")
    p_sync.add_argument("payload", help="JSON payload file")
    p_sync.add_argument("--source", default="cli", help="Source identifier")
    p_sync.add_argument("--signature", required=True, help="Payload signature")
    p_sync.set_defaults(func=_cmd_manual)

    p_reg = subparsers.add_parser(
        "register-endpoint", help="Register fallback endpoint"
    )
    p_reg.add_argument("connector", help="Connector name")
    p_reg.add_argument("endpoint", help="URL or IPFS hash")
    p_reg.set_defaults(func=_cmd_register)

    p_toggle = subparsers.add_parser(
        "toggle-connector", help="Enable or disable connector"
    )
    p_toggle.add_argument("connector")
    g = p_toggle.add_mutually_exclusive_group(required=True)
    g.add_argument("--enable", action="store_true")
    g.add_argument("--disable", action="store_true")
    p_toggle.set_defaults(func=_cmd_toggle)
