from pathlib import Path

from reflect_prompt import calculate_mirror_score, export_feed, growth_trends


def test_reflector_feed_generation(tmp_path: Path):
    prompts = ["Anchor trust", "Mirror learning loop"]
    score = calculate_mirror_score(prompts)
    assert 0 <= score <= 316

    trend = growth_trends([100, 120, 140], score)
    assert "delta" in trend and "trend" in trend

    output_path = tmp_path / "vaultfire_reflector.js"
    export_feed(score, trend, prompts, output_path)
    content = output_path.read_text()
    assert "vaultfireReflectorFeed" in content
    assert "farcaster_ready" in content

