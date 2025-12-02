from pathlib import Path

from echo_capture import EchoCapture


def test_capture_echo_and_imprint_density(tmp_path: Path):
    capture = EchoCapture()
    capture.log_prompt("p1", "remember the drift", sentiment=0.1)
    record = capture.capture_echo("p1", "remember the drift", replay_sentiment=0.4)

    assert record.origin_prompt == "p1"
    assert record.replay_count == 1
    assert record.sentiment_shift == 0.30000000000000004
    assert 0 < record.imprint_density <= 1

    sync_path = tmp_path / "echo_export.js"
    exported_path = capture.sync_to_mirror(sync_path)

    assert exported_path.exists()
    content = exported_path.read_text()
    assert "vaultfireReflectorFeed" in content
    assert "remember the drift" in content
