"""Command-line UI for the Vaultfire Memory Mirror Protocol."""

from __future__ import annotations

import argparse
import json
from typing import Iterable

from vaultfire_memory_mirror import (
    FINAL_DECLARATION,
    flush_memory,
    list_top_of_mind,
    log_snapshot,
    register_memory,
    restore_flushed_memories,
    update_pin,
)


def _parse_tags(raw: str | Iterable[str]) -> list[str]:
    if isinstance(raw, str):
        values = [item.strip() for item in raw.split(",")]
    else:
        values = [item.strip() for item in raw]
    return [item for item in values if item]


def _print_entry(entry) -> None:
    print("-" * 60)
    print(f"Memory ID       : {entry.memory_id}")
    print(f"Source          : {entry.source or 'unspecified'}")
    print(f"Tags            : {', '.join(entry.tags) or 'none'}")
    print(f"Relevance Score : {entry.relevance_score:.2f}")
    print(f"Reference Count : {entry.reference_frequency}")
    print(f"Engagement Vol. : {entry.engagement_volume}")
    print(f"Emotional Tone  : {entry.emotional_impact}")
    print(f"Pinned          : {entry.pinned}")
    print(f"Locked          : {entry.locked}")
    print(f"Ethics Verified : {entry.ethics_verified}")
    print(f"Top Priority    : {entry.top_priority}")
    print(f"Last Updated    : {entry.last_updated}")


def cmd_view(_: argparse.Namespace) -> None:
    entries = list_top_of_mind()
    if not entries:
        print("No top-of-mind memories have been recorded yet.")
        return
    print("Top-of-Mind Vaultfire Memories:\n")
    for entry in entries:
        _print_entry(entry)
    print("\n" + FINAL_DECLARATION)


def cmd_register(args: argparse.Namespace) -> None:
    entry = register_memory(
        memory_id=args.memory_id,
        content=args.content,
        tags=_parse_tags(args.tags),
        source=args.source or "cli",
        alignment_score=args.alignment_score,
        engagement_delta=args.engagement,
        emotional_impact=args.emotion,
        ethics_verified=not args.unverified,
    )
    print("Registered/updated memory:\n")
    _print_entry(entry)


def cmd_pin(args: argparse.Namespace) -> None:
    entry = update_pin(args.memory_id, pinned=args.pin, locked=args.lock)
    state = "locked" if entry.locked else "pinned" if entry.pinned else "unpinned"
    print(f"Memory '{args.memory_id}' is now {state}.")
    _print_entry(entry)


def cmd_flush(args: argparse.Namespace) -> None:
    allowed = flush_memory(
        args.memory_id,
        consent=args.consent,
        replacement_alignment=args.replacement_alignment,
    )
    if allowed:
        print(f"Memory '{args.memory_id}' has been flushed.")
    else:
        print(
            "Ethical override prevented the flush. Provide consent or a"
            " higher-alignment replacement to proceed."
        )


def cmd_snapshot(_: argparse.Namespace) -> None:
    snapshot = log_snapshot()
    print("Snapshot captured:")
    print(json.dumps(snapshot, indent=2))


def cmd_restore(args: argparse.Namespace) -> None:
    if not args.records:
        print("Provide at least one JSON record to restore.")
        return
    try:
        payload = json.loads(args.records)
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Invalid JSON payload: {exc}")
    if isinstance(payload, dict):
        records = [payload]
    elif isinstance(payload, list):
        records = payload
    else:
        raise SystemExit("JSON payload must be an object or array.")
    restored = restore_flushed_memories(records)
    if not restored:
        print("No records matched the auto-restore filters.")
        return
    print(f"Restored {len(restored)} memory record(s).")
    for entry in restored:
        _print_entry(entry)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    view_p = sub.add_parser("view", help="Show top-of-mind memories.")
    view_p.set_defaults(func=cmd_view)

    register_p = sub.add_parser("register", help="Register or update a memory.")
    register_p.add_argument("memory_id", help="Stable identifier for the memory cell.")
    register_p.add_argument("content", help="Content summary for the memory.")
    register_p.add_argument("--tags", default="Vaultfire", help="Comma-separated tag list.")
    register_p.add_argument("--source", help="Source identifier for the memory.")
    register_p.add_argument("--alignment-score", type=float, dest="alignment_score")
    register_p.add_argument(
        "--engagement", type=int, default=None, help="Engagement delta for the memory update."
    )
    register_p.add_argument("--emotion", help="Emotional impact label.")
    register_p.add_argument("--unverified", action="store_true", help="Mark memory as not ethics-verified.")
    register_p.set_defaults(func=cmd_register)

    pin_p = sub.add_parser("pin", help="Pin or lock a memory entry.")
    pin_p.add_argument("memory_id")
    pin_group = pin_p.add_mutually_exclusive_group(required=True)
    pin_group.add_argument("--pin", action="store_true", help="Pin the memory entry.")
    pin_group.add_argument("--unpin", action="store_true", help="Remove pinned state.")
    pin_group.add_argument("--lock", action="store_true", help="Lock the memory entry.")
    pin_group.add_argument("--unlock", action="store_true", help="Remove locked state.")
    pin_p.set_defaults(func=cmd_pin)

    flush_p = sub.add_parser("flush", help="Attempt to flush a memory entry.")
    flush_p.add_argument("memory_id")
    flush_p.add_argument("--consent", action="store_true", help="Provide explicit consent for flushing.")
    flush_p.add_argument(
        "--replacement-alignment",
        type=float,
        dest="replacement_alignment",
        help="Alignment score for the replacement memory.",
    )
    flush_p.set_defaults(func=cmd_flush)

    snapshot_p = sub.add_parser("snapshot", help="Write a snapshot entry to the mirror log.")
    snapshot_p.set_defaults(func=cmd_snapshot)

    restore_p = sub.add_parser("restore", help="Restore flushed memory records from JSON input.")
    restore_p.add_argument("records", help="JSON array/object of flushed memory records.")
    restore_p.set_defaults(func=cmd_restore)

    return parser


def main(argv: Iterable[str] | None = None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.command == "pin":
        pin = args.pin or args.lock
        lock = args.lock
        if args.unpin:
            pin = False
        if args.unlock:
            lock = False
        args.pin = pin
        args.lock = lock
    args.func(args)


if __name__ == "__main__":  # pragma: no cover - CLI entry point
    main()
