import argparse
import json
from engine.nanoloop_v1_1 import (
    repair_cell_pattern,
    stabilize_trauma,
    rebuild_tissue,
)


def _cmd_repair(args: argparse.Namespace) -> None:
    result = repair_cell_pattern(args.patient, args.region, args.wallet)
    print(json.dumps(result, indent=2))


def _cmd_stabilize(args: argparse.Namespace) -> None:
    result = stabilize_trauma(args.patient, args.notes, args.wallet)
    print(json.dumps(result, indent=2))


def _cmd_rebuild(args: argparse.Namespace) -> None:
    result = rebuild_tissue(args.patient, args.tissue, args.wallet)
    print(json.dumps(result, indent=2))


def register(subparsers: argparse._SubParsersAction) -> None:
    p_repair = subparsers.add_parser(
        "nano.repair", help="Record regenerative cell repair"
    )
    p_repair.add_argument("--patient", required=True)
    p_repair.add_argument("--region", required=True)
    p_repair.add_argument("--wallet", required=True)
    p_repair.set_defaults(func=_cmd_repair)

    p_stab = subparsers.add_parser(
        "nano.stabilize", help="Record trauma stabilization cycle"
    )
    p_stab.add_argument("--patient", required=True)
    p_stab.add_argument("--notes", required=True)
    p_stab.add_argument("--wallet", required=True)
    p_stab.set_defaults(func=_cmd_stabilize)

    p_rebuild = subparsers.add_parser(
        "nano.rebuild", help="Record tissue reconstruction cycle"
    )
    p_rebuild.add_argument("--patient", required=True)
    p_rebuild.add_argument("--tissue", required=True)
    p_rebuild.add_argument("--wallet", required=True)
    p_rebuild.set_defaults(func=_cmd_rebuild)
