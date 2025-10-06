"""Ghostkey Vaultfire activation CLI with JSON workflow support."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Iterable, Mapping

from vaultfire.modules import (
    ConsciousStateEngine,
    EthicResonantTimeEngine,
    GiftMatrixEngine,
    LivingMemoryLedger,
    MissionSoulLoop,
    PredictiveYieldFabric,
    PurposeParallaxEngine,
    QuantumEchoMirror,
    SoulLoopFabricEngine,
    TemporalDreamcatcherEngine,
    VaultfireProtocolStack,
)


def _load_json_payload(spec: str | None) -> dict[str, Any]:
    if not spec:
        return {}
    path = Path(spec)
    if path.exists():
        try:
            return json.loads(path.read_text())
        except json.JSONDecodeError:
            return {}
    try:
        return json.loads(spec)
    except json.JSONDecodeError:
        return {}


def _parse_recipient(entry: str) -> dict[str, Any] | str:
    parts = entry.split(":")
    wallet = parts[0]
    if len(parts) == 1:
        return wallet
    profile: dict[str, Any] = {"wallet": wallet}
    if len(parts) >= 2 and parts[1]:
        profile["belief_multiplier"] = float(parts[1])
    if len(parts) >= 3 and parts[2]:
        profile["trajectory_bonus"] = float(parts[2])
    return profile


def _resolve_recipients(args: argparse.Namespace, config: Mapping[str, Any]) -> list[Any]:
    recipients: list[Any] = []
    for item in config.get("recipients", []):
        if isinstance(item, Mapping):
            recipients.append(dict(item))
        else:
            recipients.append(str(item))
    for item in getattr(args, "recipient", []) or []:
        recipients.append(_parse_recipient(item))
    return recipients


def _build_context(config: Mapping[str, Any]) -> dict[str, Any]:
    identity_handle = config.get("identity_handle", "bpow20.cb.id")
    identity_ens = config.get("identity_ens", "ghostkey316.eth")
    time_engine = EthicResonantTimeEngine(
        config.get("user_id", "ghostkey-316"),
        identity_handle=identity_handle,
        identity_ens=identity_ens,
    )
    ledger = LivingMemoryLedger(
        identity_handle=identity_handle,
        identity_ens=identity_ens,
    )
    conscious = ConsciousStateEngine(
        identity_handle=identity_handle,
        identity_ens=identity_ens,
    )
    mission = MissionSoulLoop(
        identity_handle=identity_handle,
        identity_ens=identity_ens,
    )
    predictive = PredictiveYieldFabric(
        identity_handle=identity_handle,
        identity_ens=identity_ens,
    )
    fabric = SoulLoopFabricEngine(
        time_engine=time_engine,
        ledger=ledger,
        identity_handle=identity_handle,
        identity_ens=identity_ens,
    )
    mirror = QuantumEchoMirror(time_engine=time_engine, ledger=ledger)
    gift = GiftMatrixEngine(
        time_engine=time_engine,
        ledger=ledger,
        identity_handle=identity_handle,
        identity_ens=identity_ens,
    )
    dreamcatcher = TemporalDreamcatcherEngine(
        time_engine=time_engine,
        fabric=fabric,
        mission=mission,
        mirror=mirror,
        identity_handle=identity_handle,
        identity_ens=identity_ens,
    )
    parallax = PurposeParallaxEngine(
        conscious=conscious,
        mission=mission,
        predictive=predictive,
        identity_handle=identity_handle,
        identity_ens=identity_ens,
    )

    for action in config.get("actions", []):
        if isinstance(action, Mapping):
            conscious.record_action(action)
            time_engine.register_action(action)

    mission.bulk_history(config.get("intents", []))
    profile_updates = config.get("profile", {})
    if isinstance(profile_updates, Mapping):
        mission.update_profile(**profile_updates)

    exports = config.get("exports")
    if isinstance(exports, Mapping):
        predictive.bulk_register(exports)
    elif isinstance(exports, Iterable):
        predictive.bulk_register({str(item): 1.0 for item in exports})

    return {
        "config": dict(config),
        "time": time_engine,
        "ledger": ledger,
        "conscious": conscious,
        "mission": mission,
        "predictive": predictive,
        "fabric": fabric,
        "mirror": mirror,
        "gift": gift,
        "dreamcatcher": dreamcatcher,
        "parallax": parallax,
    }


def _command_timecheck(context: dict[str, Any], _: argparse.Namespace) -> Mapping[str, Any]:
    return context["time"].timecheck()


def _command_pulse(context: dict[str, Any], _: argparse.Namespace) -> Mapping[str, Any]:
    return context["time"].pulse()


def _command_confirm(context: dict[str, Any], args: argparse.Namespace) -> Mapping[str, Any]:
    identity = context["time"].metadata["identity"]  # type: ignore[index]
    actions = [dict(entry.payload) for entry in context["conscious"].ledger()]
    stack = VaultfireProtocolStack(
        identity_handle=str(identity.get("wallet", "bpow20.cb.id")),
        identity_ens=str(identity.get("ens", "ghostkey316.eth")),
        actions=tuple(actions),
    )
    return stack.enhancement_confirmation(include_logs=args.include_logs)


def _command_soultrace(context: dict[str, Any], args: argparse.Namespace) -> Mapping[str, Any]:
    window = args.window or 5
    trace = context["fabric"].trace(window=window)
    history = context["fabric"].history()
    return {
        "trace": trace,
        "history": history[-window:],
    }


def _command_soulpush(context: dict[str, Any], args: argparse.Namespace) -> Mapping[str, Any]:
    config = context["config"]
    signal = args.signal if args.signal is not None else float(config.get("signal", 0.5))
    intent = args.intent or config.get("intent_override") or "harmonize"
    record = context["fabric"].push_signal(signal, intent=intent)
    return {
        "record": record.to_payload(),
        "metadata": context["fabric"].metadata,
    }


def _command_mirror(context: dict[str, Any], args: argparse.Namespace) -> Mapping[str, Any]:
    trust = args.trust_floor or context["config"].get("trust_threshold", 0.6)
    return context["mirror"].project_future(trust_floor=float(trust))


def _command_giftmatrix(context: dict[str, Any], args: argparse.Namespace) -> Mapping[str, Any]:
    config = context["config"]
    gate = config.get("ego_gate", {})
    impact = args.impact if args.impact is not None else float(gate.get("impact", 1.0))
    ego = args.ego if args.ego is not None else float(gate.get("ego", 0.2))
    recipients = _resolve_recipients(args, config)
    return context["gift"].preview_allocations(
        impact=impact,
        ego=ego,
        recipients=recipients,
    )


def _command_claim(context: dict[str, Any], args: argparse.Namespace) -> Mapping[str, Any]:
    config = context["config"]
    gate = config.get("ego_gate", {})
    impact = args.impact if args.impact is not None else float(gate.get("impact", 1.0))
    ego = args.ego if args.ego is not None else float(gate.get("ego", 0.2))
    recipients = _resolve_recipients(args, config)
    claim_id = args.claim_id or config.get("claim_id", "ghost-claim")
    prepared = context["gift"].prepare_claim(
        claim_id,
        impact=impact,
        ego=ego,
        recipients=recipients,
    )
    return prepared


def _command_dreamcatcher(context: dict[str, Any], args: argparse.Namespace) -> Mapping[str, Any]:
    trust = args.trust_floor or context["config"].get("trust_threshold", 0.6)
    if args.listen:
        signals = context["config"].get("signals", [])
        return context["dreamcatcher"].listen(
            signals,
            trust_floor=float(trust),
            intent_override=context["config"].get("intent_override"),
        )
    return context["dreamcatcher"].echo(trust_floor=float(trust))


def _command_intentionmap(context: dict[str, Any], args: argparse.Namespace) -> Mapping[str, Any]:
    if args.generate:
        intent = context["config"].get("intent", "Forge aligned futures")
        confidence = float(context["config"].get("confidence", 0.88))
        tags = tuple(context["config"].get("tags", ("mission",)))
        entry = context["mission"].log_intent(intent, confidence=confidence, tags=tags)
    else:
        entry = None
    checkpoint = context["mission"].checkpoint()
    return {
        "entry": entry,
        "checkpoint": checkpoint,
    }


def _command_signalpulse(context: dict[str, Any], args: argparse.Namespace) -> Mapping[str, Any]:
    trust = args.trust_floor or context["config"].get("trust_threshold", 0.6)
    if args.trace_drift:
        return context["dreamcatcher"].trace_drift(trust_floor=float(trust), window=args.window)
    return context["dreamcatcher"].echo(trust_floor=float(trust))


def _command_parallax(context: dict[str, Any], args: argparse.Namespace) -> Mapping[str, Any]:
    if not getattr(args, "run_dual", False):
        history = context["parallax"].history()
        return history[-1] if history else {}
    intent = args.intent or context["config"].get("intent", "Safeguard the network")
    paths = context["config"].get("paths", [])
    if not isinstance(paths, Iterable):
        paths = []
    return context["parallax"].run_dual(intent, paths)


def _command_preview(context: dict[str, Any], args: argparse.Namespace) -> Mapping[str, Any]:
    if args.alignmentpath:
        tags = context["config"].get("tags", [])
        return context["parallax"].alignment_preview(tags=tags)
    return context["parallax"].history()[-1] if context["parallax"].history() else {}


COMMAND_HANDLERS: dict[str, Any] = {
    "timecheck": _command_timecheck,
    "pulse": _command_pulse,
    "confirm": _command_confirm,
    "soultrace": _command_soultrace,
    "soulpush": _command_soulpush,
    "mirror": _command_mirror,
    "giftmatrix": _command_giftmatrix,
    "claim": _command_claim,
    "dreamcatcher": _command_dreamcatcher,
    "intentionmap": _command_intentionmap,
    "signalpulse": _command_signalpulse,
    "parallax": _command_parallax,
    "preview": _command_preview,
}


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="ghostkey")
    parser.add_argument("--json", help="JSON payload containing scripted inputs", default=None)
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("timecheck")
    sub.add_parser("pulse")
    confirm = sub.add_parser("confirm")
    confirm.add_argument("--include-logs", action="store_true")

    trace = sub.add_parser("soultrace")
    trace.add_argument("--window", type=int, default=5)

    push = sub.add_parser("soulpush")
    push.add_argument("--signal", type=float, default=None)
    push.add_argument("--intent")

    mirror = sub.add_parser("mirror")
    mirror.add_argument("--trust-floor", type=float, default=None)

    gift = sub.add_parser("giftmatrix")
    gift.add_argument("--impact", type=float, default=None)
    gift.add_argument("--ego", type=float, default=None)
    gift.add_argument("--recipient", action="append", default=[])

    claim = sub.add_parser("claim")
    claim.add_argument("--impact", type=float, default=None)
    claim.add_argument("--ego", type=float, default=None)
    claim.add_argument("--recipient", action="append", default=[])
    claim.add_argument("--claim-id")

    dream = sub.add_parser("dreamcatcher")
    dream.add_argument("--listen", action="store_true")
    dream.add_argument("--trust-floor", type=float, default=None)

    intention = sub.add_parser("intentionmap")
    intention.add_argument("--generate", action="store_true")

    signal = sub.add_parser("signalpulse")
    signal.add_argument("--trace-drift", action="store_true")
    signal.add_argument("--trust-floor", type=float, default=None)
    signal.add_argument("--window", type=int, default=None)

    parallax = sub.add_parser("parallax")
    parallax.add_argument("--run-dual", action="store_true")
    parallax.add_argument("--intent")

    preview = sub.add_parser("preview")
    preview.add_argument("--alignmentpath", action="store_true")

    return parser


def run_cli(argv: list[str] | None = None) -> str:
    parser = _build_parser()
    args = parser.parse_args(argv)
    config = _load_json_payload(args.json)
    context = _build_context(config)
    handler = COMMAND_HANDLERS[args.command]
    result = handler(context, args)
    return json.dumps(result, indent=2, sort_keys=False)


def main(argv: list[str] | None = None) -> None:
    print(run_cli(argv))


if __name__ == "__main__":  # pragma: no cover - manual invocation helper
    main()

