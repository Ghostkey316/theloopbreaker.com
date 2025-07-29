import argparse
import json
from partner_plugins.partner_protocol_shell import (
    setup_shell,
    sync_echo,
    register_fallback,
    TESTBED_DIR,
)

VERSION = "Vaultfire_v27.2"


def _cmd_clone(args: argparse.Namespace) -> None:
    conf = setup_shell(VERSION, args.partner, args.ens, args.wallet)
    print(json.dumps(conf, indent=2))


def _cmd_echo(args: argparse.Namespace) -> None:
    path = TESTBED_DIR / f"{args.partner}_{VERSION}"
    if not path.exists():
        print("testbed not found")
        return
    sync_echo(path)
    print("echo synced")


def _cmd_fallback(args: argparse.Namespace) -> None:
    path = TESTBED_DIR / f"{args.partner}_{VERSION}"
    if not path.exists():
        print("testbed not found")
        return
    register_fallback(path, args.endpoint)
    print("fallback registered")


def register(subparsers: argparse._SubParsersAction) -> None:
    p_clone = subparsers.add_parser(
        "protocol.clone", help="Clone Vaultfire v27.2 testbed"
    )
    p_clone.add_argument("--partner", default="Ghostkey-316")
    p_clone.add_argument("--ens", default="ghostkey316.eth")
    p_clone.add_argument("--wallet", default="bpow20.cb.id")
    p_clone.set_defaults(func=_cmd_clone)

    p_echo = subparsers.add_parser(
        "protocol.sync-echo", help="Confirm echo sync for testbed"
    )
    p_echo.add_argument("--partner", default="Ghostkey-316")
    p_echo.set_defaults(func=_cmd_echo)

    p_fallback = subparsers.add_parser(
        "protocol.set-fallback", help="Register remote fallback"
    )
    p_fallback.add_argument("--partner", default="Ghostkey-316")
    p_fallback.add_argument("endpoint")
    p_fallback.set_defaults(func=_cmd_fallback)
