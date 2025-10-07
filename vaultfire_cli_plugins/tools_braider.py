from __future__ import annotations

import argparse
import json

from vaultfire.cli.sync import braid_threads, echo_projection, weave_recall


def _parse_growth(values: list[str] | None) -> dict[str, float]:
    parsed: dict[str, float] = {}
    for raw in values or []:
        text = raw.strip()
        if not text:
            continue
        key, _, value = text.partition("=")
        key = key.strip()
        if not key:
            continue
        try:
            parsed[key] = float(value.strip()) if value else 0.0
        except ValueError as exc:  # pragma: no cover - CLI validation
            raise ValueError(f"invalid growth value: {raw}") from exc
    return parsed


def _parse_anchors(values: list[str] | None) -> list[dict[str, object]]:
    anchors: list[dict[str, object]] = []
    for raw in values or []:
        text = raw.strip()
        if not text:
            continue
        try:
            anchors.append(json.loads(text))
        except json.JSONDecodeError as exc:  # pragma: no cover - CLI validation
            raise ValueError(f"invalid anchor payload: {raw}") from exc
    return anchors


def _cmd_braid(args: argparse.Namespace) -> None:
    result = braid_threads(
        args.statement,
        span=args.span,
        identity=args.identity,
        tags=args.tag,
        weight=args.weight,
    )
    print(json.dumps(result, indent=2, default=str))


def _cmd_recall(args: argparse.Namespace) -> None:
    frame = json.loads(args.frame) if args.frame else {}
    growth = _parse_growth(args.growth)
    result = weave_recall(
        args.signal,
        frame=frame,
        identity=args.identity,
        priorities=args.priority,
        growth_map=growth,
    )
    print(json.dumps(result, indent=2, default=str))


def _cmd_echo(args: argparse.Namespace) -> None:
    anchors = _parse_anchors(args.anchor)
    result = echo_projection(
        identity=args.identity,
        priorities=args.priority,
        resonance=args.resonance,
        anchors=anchors,
    )
    print(json.dumps(result, indent=2, default=str))


def register(subparsers: argparse._SubParsersAction) -> None:
    p_braid = subparsers.add_parser("tools:braid", help="Stitch belief statements into braider threads")
    p_braid.add_argument("--identity", default="anonymous")
    p_braid.add_argument("--span", default="live")
    p_braid.add_argument("--statement", action="append", required=True)
    p_braid.add_argument("--tag", action="append")
    p_braid.add_argument("--weight", type=float, default=1.0)
    p_braid.set_defaults(func=_cmd_braid)

    p_recall = subparsers.add_parser("tools:recall", help="Weave recall context for compass frames")
    p_recall.add_argument("--signal", required=True)
    p_recall.add_argument("--identity", default="anonymous")
    p_recall.add_argument("--priority", action="append")
    p_recall.add_argument("--frame", help="Compass frame payload as JSON")
    p_recall.add_argument("--growth", action="append", help="Growth map entries as axis=value")
    p_recall.set_defaults(func=_cmd_recall)

    p_echo = subparsers.add_parser("tools:echo", help="Project echo overlays for compass frames")
    p_echo.add_argument("--identity", default="anonymous")
    p_echo.add_argument("--priority", action="append")
    p_echo.add_argument("--resonance", type=float, default=1.0)
    p_echo.add_argument("--anchor", action="append", help="Anchor payloads in JSON format")
    p_echo.set_defaults(func=_cmd_echo)
