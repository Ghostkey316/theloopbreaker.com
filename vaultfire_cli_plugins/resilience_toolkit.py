import argparse
import json

from final_modules.grid_gpu_monitor import log_system_snapshot, summarize_state
from final_modules.behavior_drift_defense import ghostkey_shield
from final_modules.multi_domain_risk_mirror import model_misuse


def _cmd_snapshot(args: argparse.Namespace) -> None:
    result = log_system_snapshot(
        args.grid,
        args.gpu,
        args.cooling,
        args.zone,
        args.user,
    )
    print(json.dumps(result, indent=2))


def _cmd_summary(_: argparse.Namespace) -> None:
    print(json.dumps(summarize_state(), indent=2))


def _cmd_drift(args: argparse.Namespace) -> None:
    result = ghostkey_shield(args.user, args.load)
    print(json.dumps(result, indent=2))


def _cmd_risk(args: argparse.Namespace) -> None:
    result = model_misuse(args.domain, args.scenario, args.user)
    print(json.dumps(result, indent=2))


def register(subparsers: argparse._SubParsersAction) -> None:
    p_snap = subparsers.add_parser("log-grid", help="Log grid and gpu snapshot")
    p_snap.add_argument("--grid", type=float, required=True)
    p_snap.add_argument("--gpu", type=float, required=True)
    p_snap.add_argument("--cooling", type=float, required=True)
    p_snap.add_argument("--zone", default="main")
    p_snap.add_argument("--user")
    p_snap.set_defaults(func=_cmd_snapshot)

    p_sum = subparsers.add_parser("grid-summary", help="Display grid summary")
    p_sum.set_defaults(func=_cmd_summary)

    p_drift = subparsers.add_parser("drift-sim", help="Simulate behavior drift")
    p_drift.add_argument("--user", required=True)
    p_drift.add_argument("--load", type=float, required=True)
    p_drift.set_defaults(func=_cmd_drift)

    p_risk = subparsers.add_parser("risk-model", help="Run risk mirror")
    p_risk.add_argument("--domain", required=True)
    p_risk.add_argument("--scenario", required=True)
    p_risk.add_argument("--user")
    p_risk.set_defaults(func=_cmd_risk)
