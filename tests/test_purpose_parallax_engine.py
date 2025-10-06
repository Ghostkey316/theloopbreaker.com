from vaultfire.modules.purpose_parallax_engine import PurposeParallaxEngine


def test_purpose_parallax_engine_dual_path_selection() -> None:
    engine = PurposeParallaxEngine()

    result = engine.run_dual(
        "Protect the Vaultfire stack",
        [
            {"label": "uplift", "ethic": "support", "confidence": 0.92, "impact": 1.3},
            {"label": "stall", "ethic": "selfish", "confidence": 0.4, "impact": 0.2},
        ],
    )

    assert result["selected"]["label"] == "uplift"
    assert result["metadata"]["tags"][0] == "First-of-its-Kind"
    assert len(result["paths"]) == 2

    preview = engine.alignment_preview(tags=("guardian",))
    assert preview["metadata"]["identity"]["ens"] == "ghostkey316.eth"
    assert "guardian" in preview["tags"]
