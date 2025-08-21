import argparse
import json
from ghostkey_asm_sync import (
    WALLET,
    verifyImmutableSync,
    runRetroDrop,
    grantContributorRole,
    outputProof,
    syncToASM,
)


def cmd_verify(_: argparse.Namespace) -> None:
    syncToASM()
    verification = verifyImmutableSync()
    role = grantContributorRole()
    print(json.dumps({"verification": verification, "role": role}, indent=2))


def cmd_retrodrop(args: argparse.Namespace) -> None:
    result = runRetroDrop(args.wallet)
    print(json.dumps(result, indent=2))


def cmd_contributor(_: argparse.Namespace) -> None:
    status = grantContributorRole()
    print(json.dumps(status, indent=2))


def cmd_proof(_: argparse.Namespace) -> None:
    result = outputProof()
    print(json.dumps(result, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(prog="vaultfire", description="Ghostkey Vaultfire tools")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_verify = sub.add_parser("verify", help="Run full sync and role check")
    p_verify.set_defaults(func=cmd_verify)

    p_retro = sub.add_parser("retrodrop", help="Simulate retroactive yield")
    p_retro.add_argument("--wallet", default=WALLET, help="Wallet identifier")
    p_retro.set_defaults(func=cmd_retrodrop)

    p_contrib = sub.add_parser("contributor", help="Confirm contributor role status")
    p_contrib.set_defaults(func=cmd_contributor)

    p_proof = sub.add_parser("proof", help="Export Ghostkey certification proof")
    p_proof.set_defaults(func=cmd_proof)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
