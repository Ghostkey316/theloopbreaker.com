from __future__ import annotations

from datetime import datetime, timedelta, timezone

from vaultfire.protocol.signal_echo import SignalEchoEngine


def test_signal_echo_engine_records_and_replays() -> None:
    engine = SignalEchoEngine()
    base = datetime(2024, 5, 17, 12, 0, tzinfo=timezone.utc)

    engine.record_frame(
        "session-1",
        emotion="resolve",
        ethic="aligned",
        intensity=0.8,
        tags=("core", "stability"),
        timestamp=base,
    )
    engine.record_frame(
        "session-1",
        emotion="doubt",
        ethic="drift",
        intensity=0.3,
        tags=("alert",),
        timestamp=base + timedelta(seconds=5),
    )
    engine.record_frame(
        "session-2",
        emotion="calm",
        ethic="aligned",
        intensity=0.6,
        tags=("core",),
        timestamp=base + timedelta(seconds=10),
    )

    replay = engine.replay("session-1")
    assert [frame.emotion for frame in replay] == ["resolve", "doubt"]

    # The aligned frame should boost the aggregate weight into positive territory.
    weight = engine.signal_weight("session-1")
    assert weight > 0.3

    # Tag index provides a cross interaction lookup.
    core_frames = engine.tag_index("core")
    assert len(core_frames) == 2

    # Persistence round trip preserves the order and weighting.
    payload = engine.export_index()
    restored = SignalEchoEngine.from_index(payload)
    assert restored.signal_weight("session-1") == weight
    assert [frame.ethic for frame in restored.replay("session-1")] == ["aligned", "drift"]
