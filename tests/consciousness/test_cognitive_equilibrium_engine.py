from vaultfire.consciousness import CognitiveEquilibriumEngine


def test_equilibrium_engine_balances_logic_and_emotion():
    engine = CognitiveEquilibriumEngine(identity_handle="ghost", identity_ens="ghostkey316.eth")
    payload = engine.balance(
        belief=0.74,
        action_alignment=0.81,
        result_alignment=0.67,
        emotion="empathy",
        moral_pressure=0.2,
        tags=("care", "aligned"),
    )

    assert 0.0 <= payload["equilibrium"] <= 1.0
    assert payload["emotion"] == "empathy"
    assert payload["context"]["identity"]["ens"] == "ghostkey316.eth"

    status = engine.status()
    assert status["last_event"]["equilibrium"] == payload["equilibrium"]
    assert status["average_equilibrium"] >= status["baseline"] * 0.5



def test_equilibrium_recalibration_updates_weights():
    engine = CognitiveEquilibriumEngine()
    update = engine.recalibrate(baseline=0.6, emotion_weights={"focus": 0.9})

    assert update["baseline"] == 0.6
    assert update["emotion_weights"]["focus"] == 0.9
