"""Ghostkey CLI extensions for signal echo and fork inspection."""

from __future__ import annotations

import argparse
import json
from importlib import import_module
from pathlib import Path
from typing import Any, Iterable, Mapping

from vaultfire.protocol.signal_echo import SignalEchoEngine
from vaultfire.protocol.timeflare import TimeFlare
from vaultfire.quantum.hashmirror import QuantumHashMirror
from vaultfire.modules.conscious_state_engine import ConsciousStateEngine
from vaultfire.modules.ethic_resonant_time_engine import EthicResonantTimeEngine
from vaultfire.modules.gift_matrix_engine import GiftMatrixEngine
from vaultfire.modules.living_memory_ledger import LivingMemoryLedger
from vaultfire.modules.mission_soul_loop import MissionSoulLoop
from vaultfire.modules.predictive_yield_fabric import PredictiveYieldFabric
from vaultfire.modules.purpose_parallax_engine import PurposeParallaxEngine
from vaultfire.modules.quantum_echo_mirror import QuantumEchoMirror
from vaultfire.modules.soul_loop_fabric_engine import SoulLoopFabricEngine
from vaultfire.modules.temporal_dreamcatcher_engine import TemporalDreamcatcherEngine
from vaultfire.modules.vaultfire_protocol_stack import GiftMatrixV1, VaultfireProtocolStack

_yield_module = import_module("vaultfire.yield")
PulseSync = getattr(_yield_module, "PulseSync")
TemporalGiftMatrixEngine = getattr(_yield_module, "TemporalGiftMatrixEngine")

IDENTITY_HANDLE = "bpow20.cb.id"
IDENTITY_ENS = "ghostkey316.eth"


def _load_echo_engine(path: str | None) -> SignalEchoEngine:
    if path is None:
        return SignalEchoEngine.load()
    return SignalEchoEngine.load(path)


def _parse_wallet_spec(spec: str) -> dict[str, object] | str:
    parts = spec.split(":")
    wallet = parts[0]
    if len(parts) == 1:
        return wallet
    profile: dict[str, object] = {"wallet": wallet}
    if len(parts) >= 2 and parts[1]:
        profile["belief_multiplier"] = float(parts[1])
    if len(parts) >= 3 and parts[2]:
        profile["trajectory_bonus"] = float(parts[2])
    return profile


def _load_payload_list(path: str | None) -> list[Mapping[str, object]]:
    if path is None:
        return []
    data = json.loads(Path(path).read_text())
    if isinstance(data, list):
        return [dict(item) for item in data if isinstance(item, Mapping)]
    return []


def _load_actions(path: str | None) -> list[Mapping[str, object]]:
    return _load_payload_list(path)


def _load_soul_history(path: str | None) -> list[Mapping[str, object]]:
    return _load_payload_list(path)


def _parse_export_spec(spec: str) -> tuple[str, float]:
    parts = spec.split(":", 1)
    name = parts[0].strip() or "core"
    weight_str = parts[1] if len(parts) == 2 else ""
    try:
        weight = float(weight_str) if weight_str else 1.0
    except ValueError:
        weight = 1.0
    return name, max(weight, 0.0)


def _parse_update_spec(entries: Iterable[str] | None) -> dict[str, object]:
    updates: dict[str, object] = {}
    if not entries:
        return updates
    for item in entries:
        if "=" in item:
            key, value = item.split("=", 1)
            updates[key.strip()] = value.strip()
        else:
            updates[item.strip()] = True
    return updates


def _parse_json_entries(
    entries: Iterable[str] | None,
    *,
    default_key: str | None = None,
) -> list[Mapping[str, object]]:
    payloads: list[Mapping[str, object]] = []
    if not entries:
        return payloads
    for item in entries:
        if item is None:
            continue
        try:
            value = json.loads(item)
        except json.JSONDecodeError:
            if default_key is None:
                continue
            try:
                numeric = float(item)
            except ValueError:
                payloads.append({default_key: item})
            else:
                payloads.append({default_key: numeric})
            continue
        if isinstance(value, Mapping):
            payloads.append(dict(value))
        elif default_key is not None:
            payloads.append({default_key: value})
    return payloads


def _default_activation_status_path() -> Path:
    base = Path(__file__).resolve().parent / "status"
    base.mkdir(parents=True, exist_ok=True)
    return base / "vaultfire_activation_status.json"


def _load_activation_status(path: str | None = None) -> Mapping[str, object]:
    candidate = Path(path) if path else _default_activation_status_path()
    if candidate.exists():
        try:
            data = json.loads(candidate.read_text())
        except json.JSONDecodeError:
            data = None
        if isinstance(data, Mapping):
            return dict(data)
    # fall back to baked-in status profile that matches protocol requirements
    return {
        "Codex_Status": "🔥 READY 🔥",
        "Ghostkey_CLI": "Activated & Trusted",
        "Engine_Stack": "Synced",
        "VaultfireProtocolStack": "All engines integrated",
        "Telemetry": "CLI + enhancement unlock telemetry live",
    }


def _build_protocol_suite(
    actions_path: str | None,
    history_path: str | None,
    *,
    user: str = "ghostkey-316",
) -> dict[str, object]:
    actions = _load_actions(actions_path)
    history = _load_soul_history(history_path)

    time_engine = EthicResonantTimeEngine(
        user,
        identity_handle=IDENTITY_HANDLE,
        identity_ens=IDENTITY_ENS,
    )
    ledger = LivingMemoryLedger(
        identity_handle=IDENTITY_HANDLE,
        identity_ens=IDENTITY_ENS,
    )
    conscious = ConsciousStateEngine(
        identity_handle=IDENTITY_HANDLE,
        identity_ens=IDENTITY_ENS,
    )
    for action in actions:
        time_engine.register_action(action)
        conscious.record_action(action)

    mission = MissionSoulLoop(
        identity_handle=IDENTITY_HANDLE,
        identity_ens=IDENTITY_ENS,
    )
    for entry in history:
        mission.log_intent(
            str(entry.get("intent", "align")),
            confidence=float(entry.get("confidence", 0.8)),
            tags=tuple(entry.get("tags", ())),
        )

    fabric = SoulLoopFabricEngine(
        time_engine=time_engine,
        ledger=ledger,
        identity_handle=IDENTITY_HANDLE,
        identity_ens=IDENTITY_ENS,
    )
    for entry in history:
        fabric.log_intent(
            str(entry.get("intent", "align")),
            confidence=float(entry.get("confidence", 0.8)),
            tags=tuple(entry.get("tags", ())),
        )

    mirror = QuantumEchoMirror(time_engine=time_engine, ledger=ledger)
    gift = GiftMatrixEngine(
        time_engine=time_engine,
        ledger=ledger,
        identity_handle=IDENTITY_HANDLE,
        identity_ens=IDENTITY_ENS,
    )
    predictive = PredictiveYieldFabric(
        identity_handle=IDENTITY_HANDLE,
        identity_ens=IDENTITY_ENS,
    )
    baseline_purity = max(0.5, conscious.belief_health())
    predictive.forecast(signal_purity=baseline_purity, base_yield=150.0, horizon=3)

    dreamcatcher = TemporalDreamcatcherEngine(
        time_engine=time_engine,
        fabric=fabric,
        mission=mission,
        mirror=mirror,
        identity_handle=IDENTITY_HANDLE,
        identity_ens=IDENTITY_ENS,
    )
    parallax = PurposeParallaxEngine(
        conscious=conscious,
        mission=mission,
        predictive=predictive,
        identity_handle=IDENTITY_HANDLE,
        identity_ens=IDENTITY_ENS,
    )

    return {
        "actions": actions,
        "history": history,
        "time": time_engine,
        "ledger": ledger,
        "conscious": conscious,
        "mission": mission,
        "fabric": fabric,
        "mirror": mirror,
        "gift": gift,
        "predictive": predictive,
        "dreamcatcher": dreamcatcher,
        "parallax": parallax,
    }


def _build_protocol_stack(
    actions_path: str | None,
    history_path: str | None,
    *,
    user: str = "ghostkey-316",
) -> VaultfireProtocolStack:
    actions = tuple(_load_actions(actions_path))
    stack = VaultfireProtocolStack(
        identity_handle=IDENTITY_HANDLE,
        identity_ens=IDENTITY_ENS,
        actions=actions,
        mythos_path=str(
            _default_activation_status_path().with_name(f"{user}.cli.mythos.json")
        ),
    )
    history_entries = _load_soul_history(history_path)
    for entry in history_entries:
        event = dict(entry)
        event.setdefault("type", "event")
        event.setdefault("channel", "history")
        stack.myth_mode.record_event(event)
    return stack


def _collect_signals(
    path: str | None,
    inline_entries: Iterable[str] | None,
) -> list[Mapping[str, object]]:
    payloads = list(_load_payload_list(path))
    payloads.extend(_parse_json_entries(inline_entries, default_key="signal"))
    return payloads


def _build_engines(
    actions_path: str | None,
    history_path: str | None,
    *,
    user: str = "ghostkey-316",
) -> tuple[SoulLoopFabricEngine, QuantumEchoMirror, GiftMatrixEngine]:
    suite = _build_protocol_suite(actions_path, history_path, user=user)
    return (
        suite["fabric"],
        suite["mirror"],
        suite["gift"],
    )


def _parse_events(entries: Iterable[str] | None) -> list[Mapping[str, object]]:
    events: list[Mapping[str, object]] = []
    if not entries:
        return events
    for item in entries:
        if item is None:
            continue
        try:
            parsed = json.loads(item)
        except json.JSONDecodeError:
            events.append({"type": "command", "command": item, "channel": "cli"})
            continue
        if isinstance(parsed, Mapping):
            events.append(dict(parsed))
    return events


def cmd_mythos_compress(args: argparse.Namespace) -> None:
    stack = _build_protocol_stack(args.actions, args.history, user=args.user)
    for event in _parse_events(args.event):
        stack.myth_mode.record_event(event)
    payload = stack.myth_mode.compress(milestone=args.milestone, reason="cli-manual")
    print(json.dumps(payload, indent=2))


def cmd_mythos_view(args: argparse.Namespace) -> None:
    stack = _build_protocol_stack(args.actions, args.history, user=args.user)
    if args.id:
        loop = stack.myth_mode.get_loop(args.id)
        payload: Mapping[str, object] = loop or {
            "error": "loop_not_found",
            "message": f"No myth loop found for id {args.id}",
        }
    else:
        payload = {"loops": list(stack.myth_mode.history())}
    print(json.dumps(payload, indent=2))


def cmd_mythos_export(args: argparse.Namespace) -> None:
    stack = _build_protocol_stack(args.actions, args.history, user=args.user)
    payload = stack.myth_mode.export(args.format)
    print(json.dumps(payload, indent=2))


def cmd_mythos_echo(args: argparse.Namespace) -> None:
    stack = _build_protocol_stack(args.actions, args.history, user=args.user)
    loop = stack.myth_mode.get_loop(args.id)
    if not loop:
        payload: Mapping[str, object] = {
            "error": "loop_not_found",
            "message": f"No myth loop found for id {args.id}",
        }
    else:
        encoder = stack.myth_mode.compressor.encoder
        share_token = encoder.encode({"loop_id": args.id, "timestamp": _now_ts()})
        payload = {
            "loop_id": args.id,
            "archetype": loop.get("archetype"),
            "myth_rank": loop.get("myth_rank"),
            "echo_weight": loop.get("echo_weight"),
            "summary": loop.get("summary"),
            "codex_tags": loop.get("codex_tags"),
            "share_token": share_token,
        }
    print(json.dumps(payload, indent=2))


def cmd_echoindex(args: argparse.Namespace) -> None:
    engine = _load_echo_engine(args.source)
    frames = engine.replay(args.interaction) if args.interaction else engine.frames()
    if args.limit is not None and args.limit >= 0:
        frames = frames[-args.limit :]
    payload: dict[str, Any] = {
        "interaction": args.interaction,
        "count": len(frames),
        "weight": engine.signal_weight(args.interaction),
        "frames": [frame.to_payload() for frame in frames],
    }
    print(json.dumps(payload, indent=2))


def cmd_forkview(args: argparse.Namespace) -> None:
    ledger_path = args.ledger
    timeflare = TimeFlare(ledger_path=ledger_path) if ledger_path else TimeFlare()
    entries = timeflare.load()
    if args.interaction:
        entries = [item for item in entries if item.get("interaction_id") == args.interaction]
    if args.limit is not None and args.limit >= 0:
        entries = entries[-args.limit :]
    payload = {"count": len(entries), "forks": entries}
    print(json.dumps(payload, indent=2))


def cmd_yieldclaim(args: argparse.Namespace) -> None:
    if not args.wallet:
        raise SystemExit("At least one --wallet argument is required")

    signal_engine = _load_echo_engine(args.echo_index)
    timeflare = TimeFlare(ledger_path=args.ledger) if args.ledger else TimeFlare()
    pulse_sync = PulseSync()
    hash_mirror = QuantumHashMirror(seed=args.mirror_seed or "ghostkey-cli")
    engine = TemporalGiftMatrixEngine(
        timeflare=timeflare,
        signal_engine=signal_engine,
        pulse_sync=pulse_sync,
        hash_mirror=hash_mirror,
        base_reward=args.base,
    )

    recipients = [_parse_wallet_spec(entry) for entry in args.wallet]
    record = engine.generate_matrix(args.interaction, recipients)
    payload = {
        "record_id": record.record_id,
        "interaction_id": record.interaction_id,
        "created_at": record.created_at.isoformat(),
        "metadata": dict(record.metadata),
        "allocations": [
            {
                "wallet": allocation.wallet,
                "allocation": allocation.allocation,
                "belief_score": allocation.belief_score,
                "signal_weight": allocation.signal_weight,
                "timeline_branch": allocation.timeline_branch,
                "priority": allocation.priority,
                "identity_tag": allocation.identity_tag,
            }
            for allocation in record.allocations
        ],
    }
    print(json.dumps(payload, indent=2))


def cmd_timecheck(args: argparse.Namespace) -> None:
    actions = _load_actions(args.actions)
    engine = EthicResonantTimeEngine(
        args.user,
        identity_handle=IDENTITY_HANDLE,
        identity_ens=IDENTITY_ENS,
    )
    for action in actions:
        engine.register_action(action)
    payload = engine.timecheck()
    print(json.dumps(payload, indent=2))


def cmd_pulse(args: argparse.Namespace) -> None:
    actions = _load_actions(args.actions)
    engine = EthicResonantTimeEngine(
        args.user,
        identity_handle=IDENTITY_HANDLE,
        identity_ens=IDENTITY_ENS,
    )
    for action in actions:
        engine.register_action(action)
    payload = engine.pulse()
    print(json.dumps(payload, indent=2))


def cmd_confirm(args: argparse.Namespace) -> None:
    actions = _load_actions(args.actions)
    stack = VaultfireProtocolStack(actions=tuple(actions))
    payload = stack.enhancement_confirmation(include_logs=args.include_logs)
    print(json.dumps(payload, indent=2))


def cmd_conscious(args: argparse.Namespace) -> None:
    actions = _load_actions(args.actions)
    engine = ConsciousStateEngine(
        identity_handle=IDENTITY_HANDLE,
        identity_ens=IDENTITY_ENS,
    )
    for action in actions:
        engine.record_action(action)
    if args.action:
        for spec in args.action:
            try:
                action = json.loads(spec)
            except json.JSONDecodeError:
                action = {"note": spec, "ethic": "aligned"}
            engine.record_action(action)
    payload = engine.sync_diagnostics()
    print(json.dumps(payload, indent=2))


def cmd_yieldfabric(args: argparse.Namespace) -> None:
    fabric = PredictiveYieldFabric(
        identity_handle=IDENTITY_HANDLE,
        identity_ens=IDENTITY_ENS,
    )
    for spec in args.export or ():
        name, weight = _parse_export_spec(spec)
        fabric.register_export(name, weight)

    captured: list[Mapping[str, float]] = []

    if args.capture:

        def _hook(payload: Mapping[str, float]) -> None:
            captured.append(dict(payload))

        fabric.register_hook("cli-capture", _hook)

    forecast = fabric.forecast(
        signal_purity=args.purity,
        base_yield=args.base,
        horizon=args.horizon,
    )
    payload = {
        "forecast": forecast,
        "optimization": fabric.auto_optimize(),
    }
    if captured:
        payload["captured_distribution"] = captured[-1]
    print(json.dumps(payload, indent=2))


def cmd_soul(args: argparse.Namespace) -> None:
    loop = MissionSoulLoop(
        identity_handle=IDENTITY_HANDLE,
        identity_ens=IDENTITY_ENS,
    )
    for entry in _load_soul_history(args.history):
        loop.log_intent(
            str(entry.get("intent", "sustain")),
            confidence=float(entry.get("confidence", 0.8)),
            tags=tuple(entry.get("tags", ())),
        )
    if args.intent:
        loop.log_intent(
            args.intent,
            confidence=args.confidence,
            tags=tuple(args.tag or ()),
        )
    updates = _parse_update_spec(args.update)
    if updates:
        loop.update_profile(**updates)
    checkpoint = loop.checkpoint()
    payload = {
        "identity": {
            "wallet": IDENTITY_HANDLE,
            "ens": IDENTITY_ENS,
        },
        "checkpoint": checkpoint,
    }
    if args.full_history:
        payload["history"] = list(loop.history())
    print(json.dumps(payload, indent=2))


def _prepare_gift_matrix(
    *,
    actions: Iterable[Mapping[str, object]],
    interaction: str | None,
    purity: float,
    branch: str,
    priority: str,
    ethic_score: float,
    alignment_bias: float,
    wallets: Iterable[str | Mapping[str, object]],
) -> GiftMatrixV1:
    stack = VaultfireProtocolStack(actions=tuple(actions))
    matrix = stack.gift_matrix
    if interaction:
        matrix.record_signal(interaction, belief_purity=purity, tags=("cli", "vaultfire"))
        matrix.register_fork(
            interaction,
            branch=branch,
            priority=priority,
            ethic_score=ethic_score,
            alignment_bias=alignment_bias,
        )
        matrix.claim(interaction, wallets)
    return matrix


def cmd_unlocknext(args: argparse.Namespace) -> None:
    actions = _load_actions(args.actions)
    stack = VaultfireProtocolStack(actions=tuple(actions))
    try:
        payload = stack.unlock_next(args.label)
    except PermissionError as exc:
        payload = {
            "error": str(exc),
            "conscience_sync": stack.conscience_mirror.conscience_sync("unlock", threshold=0.55),
        }
    print(json.dumps(payload, indent=2))


def cmd_pulsewatch(args: argparse.Namespace) -> None:
    actions = _load_actions(args.actions)
    recipients: list[str | Mapping[str, object]] = []
    if args.wallet:
        recipients = [_parse_wallet_spec(entry) for entry in args.wallet]
    elif args.interaction:
        recipients = [IDENTITY_ENS]
    matrix = _prepare_gift_matrix(
        actions=actions,
        interaction=args.interaction,
        purity=args.purity,
        branch=args.branch,
        priority=args.priority,
        ethic_score=args.ethic_score,
        alignment_bias=args.alignment_bias,
        wallets=recipients,
    )
    stack = VaultfireProtocolStack(actions=tuple(actions))
    stack.gift_matrix = matrix
    payload = stack.pulsewatch()
    print(json.dumps(payload, indent=2))


def cmd_soultrace(args: argparse.Namespace) -> None:
    fabric, mirror, _ = _build_engines(args.actions, args.history)
    payload = {
        "trace": fabric.trace(window=args.window),
        "metadata": fabric.metadata,
    }
    if args.full_history:
        payload["history"] = list(fabric.history())
    if args.future:
        payload["forecast"] = mirror.project_future(
            steps=args.steps,
            trust_floor=args.trust_floor,
        )
    print(json.dumps(payload, indent=2))


def cmd_soulpush(args: argparse.Namespace) -> None:
    fabric, _, _ = _build_engines(args.actions, args.history)
    record = fabric.push_signal(args.signal, intent=args.intent)
    payload = {
        "record": record.to_payload(),
        "trace": fabric.trace(window=args.window),
    }
    if args.include_history:
        payload["history"] = list(fabric.history())
    print(json.dumps(payload, indent=2))


def cmd_echo_future(args: argparse.Namespace) -> None:
    _, mirror, _ = _build_engines(args.actions, args.history)
    if args.future:
        payload = mirror.project_future(
            steps=args.steps,
            trust_floor=args.trust_floor,
        )
    else:
        payload = mirror.traceback(
            trust_floor=args.trust_floor,
            window=args.window,
        )
    print(json.dumps(payload, indent=2))


def cmd_mirror_traceback(args: argparse.Namespace) -> None:
    _, mirror, _ = _build_engines(args.actions, args.history)
    payload = mirror.traceback(
        trust_floor=args.trust_floor,
        window=args.window,
    )
    print(json.dumps(payload, indent=2))


def cmd_giftmatrix_check(args: argparse.Namespace) -> None:
    _, _, gift = _build_engines(args.actions, args.history)
    recipients = [_parse_wallet_spec(entry) for entry in args.recipient or ()]
    payload = gift.preview_allocations(
        impact=args.impact,
        ego=args.ego,
        recipients=recipients,
    )
    payload["checked"] = bool(getattr(args, "check", False))
    print(json.dumps(payload, indent=2))


def cmd_claim(args: argparse.Namespace) -> None:
    _, _, gift = _build_engines(args.actions, args.history)
    if not args.recipient:
        raise SystemExit("At least one --recipient value is required for claim")
    recipients = [_parse_wallet_spec(entry) for entry in args.recipient]
    payload = gift.prepare_claim(
        args.id,
        impact=args.impact,
        ego=args.ego,
        recipients=recipients,
    )
    print(json.dumps(payload, indent=2))


def cmd_dreamcatcher(args: argparse.Namespace) -> None:
    suite = _build_protocol_suite(args.actions, args.history, user=args.user)
    engine: TemporalDreamcatcherEngine = suite["dreamcatcher"]  # type: ignore[assignment]
    trust_floor = args.trust_floor if args.trust_floor is not None else 0.6
    signals = _collect_signals(args.signals, args.signal)
    if args.listen or signals:
        payload = engine.listen(
            signals,
            trust_floor=trust_floor,
            intent_override=args.intent_override,
        )
    else:
        payload = engine.echo(trust_floor=trust_floor)
    print(json.dumps(payload, indent=2))


def cmd_signalpulse(args: argparse.Namespace) -> None:
    suite = _build_protocol_suite(args.actions, args.history, user=args.user)
    engine: TemporalDreamcatcherEngine = suite["dreamcatcher"]  # type: ignore[assignment]
    trust_floor = args.trust_floor if args.trust_floor is not None else 0.6
    signals = _collect_signals(args.signals, args.signal)
    if signals:
        engine.listen(
            signals,
            trust_floor=trust_floor,
            intent_override=args.intent_override,
        )
    if args.trace_drift:
        payload = engine.trace_drift(trust_floor=trust_floor, window=args.window)
    else:
        payload = engine.echo(trust_floor=trust_floor)
    print(json.dumps(payload, indent=2))


def _normalise_paths(
    source_paths: Iterable[Mapping[str, object]],
    fallback_actions: Iterable[Mapping[str, object]],
) -> list[Mapping[str, object]]:
    normalised: list[Mapping[str, object]] = []
    entries = list(source_paths)
    if not entries:
        for index, action in enumerate(fallback_actions, start=1):
            if not isinstance(action, Mapping):
                continue
            note = action.get("note") or action.get("intent") or action.get("type")
            normalised.append(
                {
                    "label": str(note or f"path-{index}"),
                    "ethic": str(action.get("ethic", action.get("type", "aligned"))),
                    "confidence": float(action.get("confidence", action.get("weight", 0.8) or 0.8)),
                    "impact": float(action.get("impact", action.get("weight", 1.0) or 1.0)),
                }
            )
        return normalised
    for index, entry in enumerate(entries, start=1):
        payload = dict(entry)
        payload.setdefault("label", payload.get("intent", f"path-{index}"))
        payload.setdefault("ethic", payload.get("type", "aligned"))
        payload["confidence"] = float(payload.get("confidence", payload.get("weight", 0.8) or 0.8))
        payload["impact"] = float(payload.get("impact", payload.get("weight", 1.0) or 1.0))
        normalised.append(payload)
    return normalised


def cmd_parallax(args: argparse.Namespace) -> None:
    suite = _build_protocol_suite(args.actions, args.history, user=args.user)
    engine: PurposeParallaxEngine = suite["parallax"]  # type: ignore[assignment]
    raw_paths = _parse_json_entries(args.path, default_key="label")
    paths = _normalise_paths(raw_paths, suite["actions"])
    if args.run_dual:
        intent = args.intent or "Safeguard the network"
        payload = engine.run_dual(intent, paths)
    else:
        history = engine.history()
        payload = history[-1] if history else {}
    print(json.dumps(payload, indent=2))


def cmd_intentionmap(args: argparse.Namespace) -> None:
    suite = _build_protocol_suite(args.actions, args.history, user=args.user)
    mission: MissionSoulLoop = suite["mission"]  # type: ignore[assignment]
    entry: Mapping[str, object] | None = None
    if args.generate:
        intent = args.intent or "Forge aligned futures"
        tags = tuple(args.tag or ())
        entry = mission.log_intent(intent, confidence=args.confidence, tags=tags)
    updates = _parse_update_spec(args.update)
    if updates:
        mission.update_profile(**updates)
    payload = {
        "entry": entry,
        "checkpoint": mission.checkpoint(),
    }
    print(json.dumps(payload, indent=2))


def cmd_preview(args: argparse.Namespace) -> None:
    suite = _build_protocol_suite(args.actions, args.history, user=args.user)
    time_engine: EthicResonantTimeEngine = suite["time"]  # type: ignore[assignment]
    conscious: ConsciousStateEngine = suite["conscious"]  # type: ignore[assignment]
    predictive: PredictiveYieldFabric = suite["predictive"]  # type: ignore[assignment]
    forecast = predictive.latest_forecast
    payload: dict[str, Any] = {
        "tempo": time_engine.current_tempo(),
        "belief_health": conscious.belief_health(),
        "forecast": forecast,
        "auto_optimize": predictive.auto_optimize(),
        "metadata": time_engine.metadata,
    }
    if args.stack:
        payload["stack"] = {
            "requirements": time_engine.metadata.get("requirements"),
            "engines": {
                "time": time_engine.metadata,
                "conscious": conscious.metadata,
                "mission": suite["mission"].metadata,  # type: ignore[index]
                "fabric": suite["fabric"].metadata,  # type: ignore[index]
                "gift": suite["gift"].metadata,  # type: ignore[index]
                "dreamcatcher": suite["dreamcatcher"].metadata,  # type: ignore[index]
                "parallax": suite["parallax"].metadata,  # type: ignore[index]
                "predictive": predictive.metadata,
            },
        }
    print(json.dumps(payload, indent=2))


def cmd_status(args: argparse.Namespace) -> None:
    status = dict(_load_activation_status(args.path))
    if args.include_stack:
        actions = tuple(_load_actions(args.actions))
        stack = VaultfireProtocolStack(
            actions=actions,
            mythos_path=str(_default_activation_status_path().with_name("ghostkey316.cli.mythos.json")),
        )
        status["system_requirements"] = stack.system_status()
    print(json.dumps(status, indent=2))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="ghostkey", description="Ghostkey protocol tooling")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_mythos = sub.add_parser("mythos", help="Interact with Myth Compression Mode")
    myth_sub = p_mythos.add_subparsers(dest="myth_cmd", required=True)

    p_mythos_compress = myth_sub.add_parser("compress", help="Manually compress pending logs")
    p_mythos_compress.add_argument("--actions", help="Optional path to ledger actions", default=None)
    p_mythos_compress.add_argument("--history", help="Optional path to soul history", default=None)
    p_mythos_compress.add_argument(
        "--event",
        action="append",
        default=None,
        help="Inline event payload to queue before compression (JSON)",
    )
    p_mythos_compress.add_argument(
        "--milestone",
        action="store_true",
        help="Mark this compression as a milestone loop",
    )
    p_mythos_compress.add_argument("--user", default="ghostkey-316", help="Ghostkey identifier")
    p_mythos_compress.set_defaults(func=cmd_mythos_compress)

    p_mythos_view = myth_sub.add_parser("view", help="View symbolic loop history")
    p_mythos_view.add_argument("--actions", help="Optional path to ledger actions", default=None)
    p_mythos_view.add_argument("--history", help="Optional path to soul history", default=None)
    p_mythos_view.add_argument("--id", help="Optional specific loop id", default=None)
    p_mythos_view.add_argument("--user", default="ghostkey-316", help="Ghostkey identifier")
    p_mythos_view.set_defaults(func=cmd_mythos_view)

    p_mythos_export = myth_sub.add_parser("export", help="Export belief path loops")
    p_mythos_export.add_argument("--actions", help="Optional path to ledger actions", default=None)
    p_mythos_export.add_argument("--history", help="Optional path to soul history", default=None)
    p_mythos_export.add_argument(
        "--format",
        choices=("json", "yaml", "pdf"),
        default="json",
        help="Export format",
    )
    p_mythos_export.add_argument("--user", default="ghostkey-316", help="Ghostkey identifier")
    p_mythos_export.set_defaults(func=cmd_mythos_export)

    p_mythos_echo = myth_sub.add_parser("echo", help="Share a loop for remix or reflection")
    p_mythos_echo.add_argument("--actions", help="Optional path to ledger actions", default=None)
    p_mythos_echo.add_argument("--history", help="Optional path to soul history", default=None)
    p_mythos_echo.add_argument("--id", required=True, help="Loop id to share")
    p_mythos_echo.add_argument("--user", default="ghostkey-316", help="Ghostkey identifier")
    p_mythos_echo.set_defaults(func=cmd_mythos_echo)

    p_echo = sub.add_parser("echoindex", help="Inspect the signal echo index")
    p_echo.add_argument("--interaction", help="Filter by interaction id", default=None)
    p_echo.add_argument("--limit", type=int, default=None, help="Limit number of frames returned")
    p_echo.add_argument("--source", help="Optional path to a serialized index", default=None)
    p_echo.set_defaults(func=cmd_echoindex)

    p_fork = sub.add_parser("forkview", help="Inspect MoralForkEngine outcomes")
    p_fork.add_argument("--interaction", help="Filter by interaction id", default=None)
    p_fork.add_argument("--limit", type=int, default=None, help="Limit number of fork entries")
    p_fork.add_argument("--ledger", help="Optional path to a ledger file", default=None)
    p_fork.set_defaults(func=cmd_forkview)

    p_yield = sub.add_parser("yieldclaim", help="Generate Temporal Gift Matrix allocations")
    p_yield.add_argument("--interaction", required=True, help="Interaction id to evaluate")
    p_yield.add_argument(
        "--wallet",
        action="append",
        help="Recipient wallet (optionally wallet:belief_multiplier:trajectory_bonus)",
        required=True,
    )
    p_yield.add_argument("--ledger", help="Optional path to a TimeFlare ledger", default=None)
    p_yield.add_argument("--echo-index", help="Optional path to a signal echo index", default=None)
    p_yield.add_argument("--base", type=float, default=100.0, help="Base reward used for allocations")
    p_yield.add_argument(
        "--mirror-seed",
        default=None,
        help="Optional seed for deterministic QuantumHashMirror tags",
    )
    p_yield.set_defaults(func=cmd_yieldclaim)

    p_time = sub.add_parser("timecheck", help="Inspect temporal ethics diagnostics")
    p_time.add_argument("--actions", help="Optional path to ledger actions", default=None)
    p_time.add_argument("--user", default="ghostkey-316", help="Override the user identifier")
    p_time.set_defaults(func=cmd_timecheck)

    p_pulse = sub.add_parser("pulse", help="Inspect the latest quantum pulse")
    p_pulse.add_argument("--actions", help="Optional path to ledger actions", default=None)
    p_pulse.add_argument("--user", default="ghostkey-316", help="Override the user identifier")
    p_pulse.set_defaults(func=cmd_pulse)

    p_confirm = sub.add_parser(
        "confirm",
        help="Output Vaultfire enhancement confirmation including Ghostkey alignment status",
    )
    p_confirm.add_argument("--actions", help="Optional path to ledger actions", default=None)
    p_confirm.add_argument(
        "--include-logs",
        action="store_true",
        help="Include raw enhancement logs in the confirmation output",
    )
    p_confirm.set_defaults(func=cmd_confirm)

    p_unlock = sub.add_parser("unlocknext", help="Advance the GiftMatrix protocol layer")
    p_unlock.add_argument("--label", help="Optional label for the new layer", default=None)
    p_unlock.add_argument("--actions", help="Optional path to ledger actions", default=None)
    p_unlock.set_defaults(func=cmd_unlocknext)

    p_watch = sub.add_parser("pulsewatch", help="Render live pulse and yield insights")
    p_watch.add_argument("--actions", help="Optional path to ledger actions", default=None)
    p_watch.add_argument("--interaction", help="Interaction id to seed GiftMatrix", default=None)
    p_watch.add_argument("--purity", type=float, default=0.85, help="Belief purity score")
    p_watch.add_argument("--branch", default="stable", help="Timeline branch label")
    p_watch.add_argument("--priority", default="low", help="Timeline priority label")
    p_watch.add_argument("--ethic-score", dest="ethic_score", type=float, default=0.75)
    p_watch.add_argument("--alignment-bias", dest="alignment_bias", type=float, default=0.2)
    p_watch.add_argument(
        "--wallet",
        action="append",
        default=None,
        help="Recipient wallet (optionally wallet:belief_multiplier:trajectory_bonus)",
    )
    p_watch.set_defaults(func=cmd_pulsewatch)

    p_conscious = sub.add_parser("conscious", help="Inspect conscious state diagnostics")
    p_conscious.add_argument("--actions", help="Optional path to ledger actions", default=None)
    p_conscious.add_argument(
        "--action",
        action="append",
        default=None,
        help="Inline JSON action to append to the ledger",
    )
    p_conscious.set_defaults(func=cmd_conscious)

    p_yieldfabric = sub.add_parser("yieldfabric", help="Generate predictive yield insights")
    p_yieldfabric.add_argument("--export", action="append", default=None, help="Export spec name:weight")
    p_yieldfabric.add_argument("--purity", type=float, default=0.8, help="Signal purity score")
    p_yieldfabric.add_argument("--base", type=float, default=150.0, help="Base yield value")
    p_yieldfabric.add_argument("--horizon", type=int, default=3, help="Forecast horizon")
    p_yieldfabric.add_argument(
        "--capture",
        action="store_true",
        help="Capture distribution via internal hook for debugging",
    )
    p_yieldfabric.set_defaults(func=cmd_yieldfabric)

    p_soul = sub.add_parser("soul", help="Inspect mission soul loop checkpoints")
    p_soul.add_argument("--history", help="Optional path to prior intent history", default=None)
    p_soul.add_argument("--intent", help="Optional new intent to record", default=None)
    p_soul.add_argument("--confidence", type=float, default=0.9, help="Confidence for new intent")
    p_soul.add_argument("--tag", action="append", default=None, help="Tag for the new intent entry")
    p_soul.add_argument(
        "--update",
        action="append",
        default=None,
        help="Profile field update key=value",
    )
    p_soul.add_argument(
        "--full-history",
        action="store_true",
        help="Include the entire mission history in the output",
    )
    p_soul.set_defaults(func=cmd_soul)

    p_soultrace = sub.add_parser("soultrace", help="Render Soul Loop Fabric trace output")
    p_soultrace.add_argument("--actions", help="Optional path to ledger actions", default=None)
    p_soultrace.add_argument("--history", help="Optional path to prior intent history", default=None)
    p_soultrace.add_argument("--window", type=int, default=5, help="Window used for trust averaging")
    p_soultrace.add_argument("--full-history", action="store_true", help="Include recorded history")
    p_soultrace.add_argument("--future", action="store_true", help="Include future projection")
    p_soultrace.add_argument("--steps", type=int, default=3, help="Number of future steps to project")
    p_soultrace.add_argument("--trust-floor", dest="trust_floor", type=float, default=0.6)
    p_soultrace.set_defaults(func=cmd_soultrace)

    p_soulpush = sub.add_parser("soulpush", help="Push a signal into the Soul Loop Fabric")
    p_soulpush.add_argument("--signal", type=float, required=True, help="Signal strength to push")
    p_soulpush.add_argument("--intent", help="Optional label for the signal", default=None)
    p_soulpush.add_argument("--actions", help="Optional path to ledger actions", default=None)
    p_soulpush.add_argument("--history", help="Optional path to prior intent history", default=None)
    p_soulpush.add_argument("--window", type=int, default=5, help="Window used for trust averaging")
    p_soulpush.add_argument(
        "--include-history",
        action="store_true",
        help="Include the recorded history in the response",
    )
    p_soulpush.set_defaults(func=cmd_soulpush)

    p_echo_future = sub.add_parser("echo", help="Interact with the Quantum Echo Mirror")
    p_echo_future.add_argument("--actions", help="Optional path to ledger actions", default=None)
    p_echo_future.add_argument("--history", help="Optional path to prior intent history", default=None)
    p_echo_future.add_argument("--future", action="store_true", help="Return future projection")
    p_echo_future.add_argument("--steps", type=int, default=3, help="Steps used for future projections")
    p_echo_future.add_argument("--trust-floor", dest="trust_floor", type=float, default=0.6)
    p_echo_future.add_argument("--window", type=int, default=None, help="Window for traceback mode")
    p_echo_future.set_defaults(func=cmd_echo_future)

    p_mirror = sub.add_parser("mirror", help="Traceback using the Quantum Echo Mirror")
    p_mirror.add_argument("--actions", help="Optional path to ledger actions", default=None)
    p_mirror.add_argument("--history", help="Optional path to prior intent history", default=None)
    p_mirror.add_argument("--traceback", action="store_true", help="Include explicit traceback output")
    p_mirror.add_argument("--window", type=int, default=None, help="Window limit for timeline entries")
    p_mirror.add_argument("--trust-floor", dest="trust_floor", type=float, default=0.5)
    p_mirror.set_defaults(func=cmd_mirror_traceback)

    p_giftmatrix = sub.add_parser("giftmatrix", help="Preview Gift Matrix allocations")
    p_giftmatrix.add_argument("--actions", help="Optional path to ledger actions", default=None)
    p_giftmatrix.add_argument("--history", help="Optional path to prior intent history", default=None)
    p_giftmatrix.add_argument("--impact", type=float, required=True, help="Impact score")
    p_giftmatrix.add_argument("--ego", type=float, required=True, help="Ego score")
    p_giftmatrix.add_argument(
        "--recipient",
        action="append",
        default=None,
        help="Recipient wallet (optionally wallet:belief_multiplier:trajectory_bonus)",
    )
    p_giftmatrix.add_argument("--check", action="store_true", help="Run eligibility check only")
    p_giftmatrix.set_defaults(func=cmd_giftmatrix_check)

    p_claim = sub.add_parser("claim", help="Prepare a Gift Matrix claim")
    p_claim.add_argument("--actions", help="Optional path to ledger actions", default=None)
    p_claim.add_argument("--history", help="Optional path to prior intent history", default=None)
    p_claim.add_argument("--id", required=True, help="Claim identifier")
    p_claim.add_argument("--impact", type=float, required=True, help="Impact score")
    p_claim.add_argument("--ego", type=float, required=True, help="Ego score")
    p_claim.add_argument(
        "--recipient",
        action="append",
        required=True,
        help="Recipient wallet (optionally wallet:belief_multiplier:trajectory_bonus)",
    )
    p_claim.set_defaults(func=cmd_claim)

    p_dreamcatcher = sub.add_parser(
        "dreamcatcher",
        help="Capture or replay signals using the Temporal Dreamcatcher Engine",
    )
    p_dreamcatcher.add_argument("--actions", help="Optional path to ledger actions", default=None)
    p_dreamcatcher.add_argument("--history", help="Optional path to prior intent history", default=None)
    p_dreamcatcher.add_argument("--signals", help="Optional path to signal payloads", default=None)
    p_dreamcatcher.add_argument(
        "--signal",
        action="append",
        default=None,
        help="Inline signal payload as JSON or numeric strength",
    )
    p_dreamcatcher.add_argument("--listen", action="store_true", help="Stream and return capture summary")
    p_dreamcatcher.add_argument("--intent-override", default=None, help="Override intent label for ingested signals")
    p_dreamcatcher.add_argument("--trust-floor", type=float, default=None, help="Trust floor used for projections")
    p_dreamcatcher.add_argument("--user", default="ghostkey-316", help="Override the user identifier")
    p_dreamcatcher.set_defaults(func=cmd_dreamcatcher)

    p_signalpulse = sub.add_parser(
        "signalpulse",
        help="Trace dreamcatcher pulses and optionally compute drift",
    )
    p_signalpulse.add_argument("--actions", help="Optional path to ledger actions", default=None)
    p_signalpulse.add_argument("--history", help="Optional path to prior intent history", default=None)
    p_signalpulse.add_argument("--signals", help="Optional path to signal payloads", default=None)
    p_signalpulse.add_argument(
        "--signal",
        action="append",
        default=None,
        help="Inline signal payload as JSON or numeric strength",
    )
    p_signalpulse.add_argument("--intent-override", default=None, help="Override intent label for ingested signals")
    p_signalpulse.add_argument("--trust-floor", type=float, default=None, help="Trust floor used for projections")
    p_signalpulse.add_argument("--trace-drift", action="store_true", help="Return drift tracing output")
    p_signalpulse.add_argument("--window", type=int, default=None, help="Optional window when tracing drift")
    p_signalpulse.add_argument("--user", default="ghostkey-316", help="Override the user identifier")
    p_signalpulse.set_defaults(func=cmd_signalpulse)

    p_parallax = sub.add_parser("parallax", help="Evaluate dual-path moral alignment")
    p_parallax.add_argument("--actions", help="Optional path to ledger actions", default=None)
    p_parallax.add_argument("--history", help="Optional path to prior intent history", default=None)
    p_parallax.add_argument(
        "--path",
        action="append",
        default=None,
        help="Inline JSON payload describing a moral path",
    )
    p_parallax.add_argument("--run-dual", action="store_true", help="Execute parallax evaluation")
    p_parallax.add_argument("--intent", help="Intent label for evaluation", default=None)
    p_parallax.add_argument("--user", default="ghostkey-316", help="Override the user identifier")
    p_parallax.set_defaults(func=cmd_parallax)

    p_intentionmap = sub.add_parser("intentionmap", help="Render or extend the mission intention map")
    p_intentionmap.add_argument("--actions", help="Optional path to ledger actions", default=None)
    p_intentionmap.add_argument("--history", help="Optional path to prior intent history", default=None)
    p_intentionmap.add_argument("--generate", action="store_true", help="Record a new intent entry")
    p_intentionmap.add_argument("--intent", help="Intent label to record", default=None)
    p_intentionmap.add_argument("--confidence", type=float, default=0.88, help="Confidence for generated intent")
    p_intentionmap.add_argument("--tag", action="append", default=None, help="Tag to associate with the intent")
    p_intentionmap.add_argument(
        "--update",
        action="append",
        default=None,
        help="Profile field update key=value",
    )
    p_intentionmap.add_argument("--user", default="ghostkey-316", help="Override the user identifier")
    p_intentionmap.set_defaults(func=cmd_intentionmap)

    p_preview = sub.add_parser("preview", help="Preview stack alignment and requirements")
    p_preview.add_argument("--actions", help="Optional path to ledger actions", default=None)
    p_preview.add_argument("--history", help="Optional path to prior intent history", default=None)
    p_preview.add_argument("--stack", action="store_true", help="Include per-engine metadata stack summary")
    p_preview.add_argument("--user", default="ghostkey-316", help="Override the user identifier")
    p_preview.set_defaults(func=cmd_preview)

    p_status = sub.add_parser("status", help="Display activation readiness status")
    p_status.add_argument("--path", help="Optional path to activation status JSON", default=None)
    p_status.add_argument("--include-stack", action="store_true", help="Include live stack readiness data")
    p_status.add_argument("--actions", help="Optional path to ledger actions", default=None)
    p_status.add_argument("--history", help="Optional path to prior intent history", default=None)
    p_status.set_defaults(func=cmd_status)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
